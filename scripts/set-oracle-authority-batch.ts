/**
 * PERC-806: Batch SetOracleAuthority for all markets whose oracle_authority
 * is NOT the keeper wallet (FF7KFfU5...).
 *
 * Background:
 *   Markets created with oracle_authority = market creator's own wallet.
 *   The oracle-keeper (FF7KFfU5...) cannot push prices → Custom:15 → no mark_price.
 *   SetOracleAuthority must be signed by the market ADMIN (= the creator wallet).
 *
 * What this script does:
 *   1. Discovers all markets on-chain via discoverMarkets()
 *   2. Filters to markets where oracle_authority != KEEPER_WALLET
 *   3. Groups mismatched markets by their market admin pubkey
 *   4. For each admin group, looks for a matching keypair on disk
 *   5. Calls SetOracleAuthority for all markets it can fix, skips the rest
 *   6. Reports which admin keypairs are still needed
 *
 * Keypair discovery (checked in order):
 *   a. KEYPAIR_DIR env var (directory containing <pubkey>.json files)
 *   b. ~/.config/solana/<pubkey>.json
 *   c. ADMIN_KEYPAIR env var (single keypair, used for all matching markets)
 *
 * Usage:
 *   # Dry run — shows affected markets grouped by admin, no txns sent:
 *   npx tsx scripts/set-oracle-authority-batch.ts --dry-run
 *
 *   # Live run with single admin keypair:
 *   ADMIN_KEYPAIR=/path/to/admin.json npx tsx scripts/set-oracle-authority-batch.ts
 *
 *   # Live run with directory of keypairs (files named <pubkey>.json):
 *   KEYPAIR_DIR=~/.config/solana/market-admins npx tsx scripts/set-oracle-authority-batch.ts
 *
 *   # With Helius RPC (avoids public devnet 429):
 *   HELIUS_API_KEY=<key> ADMIN_KEYPAIR=/path/to/key.json npx tsx scripts/set-oracle-authority-batch.ts
 *
 * Environment:
 *   ADMIN_KEYPAIR    Path to a single admin keypair JSON
 *   KEYPAIR_DIR      Directory containing <pubkey>.json files (one per admin)
 *   HELIUS_API_KEY   Helius API key for devnet RPC (recommended)
 *   RPC_URL          Override RPC URL
 *   BATCH_SIZE       Txns per batch before pause (default: 5)
 *   BATCH_DELAY_MS   Milliseconds between batches (default: 1500)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { discoverMarkets } from "@percolator/sdk";
import {
  encodeSetOracleAuthority,
  buildAccountMetas,
  ACCOUNTS_SET_ORACLE_AUTHORITY,
  buildIx,
} from "../packages/core/src/index.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const SMALL_PROGRAM = new PublicKey("FwfBKZXbYr4vTK23bMFkbgKq3npJ3MSDxEaKmq9Aj4Qn");

/** The oracle-keeper wallet that should own oracle_authority on all markets. */
const KEEPER_WALLET = new PublicKey("FF7KFfU5Bb3Mze2AasDHCCZuyhdaSLjUZy2K3JvjdB7x");

const HELIUS_KEY = process.env.HELIUS_API_KEY ?? process.env.HELIUS_DEVNET_API_KEY ?? "";
const RPC_URL =
  process.env.RPC_URL ??
  (HELIUS_KEY
    ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
    : "https://api.devnet.solana.com");

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? "5");
const BATCH_DELAY_MS = Number(process.env.BATCH_DELAY_MS ?? "1500");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function printBanner(label: string) {
  console.log("\n" + "=".repeat(70));
  console.log(label);
  console.log("=".repeat(70));
}

function loadKeypair(filePath: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
  );
}

/**
 * Try to load a keypair for the given pubkey.
 * Checks: KEYPAIR_DIR/<pubkey>.json, ~/.config/solana/<pubkey>.json
 * Falls back to ADMIN_KEYPAIR if that keypair matches the target pubkey.
 */
function findKeypairForAdmin(
  adminPubkey: PublicKey,
  fallbackKp: Keypair | null
): Keypair | null {
  const pubkeyStr = adminPubkey.toBase58();

  // 1. KEYPAIR_DIR
  if (process.env.KEYPAIR_DIR) {
    const p = path.join(process.env.KEYPAIR_DIR, `${pubkeyStr}.json`);
    if (fs.existsSync(p)) {
      try {
        return loadKeypair(p);
      } catch {
        console.warn(`  ⚠️  Failed to load keypair at ${p}`);
      }
    }
  }

  // 2. ~/.config/solana/<pubkey>.json
  const defaultPath = path.join(process.env.HOME!, ".config/solana", `${pubkeyStr}.json`);
  if (fs.existsSync(defaultPath)) {
    try {
      return loadKeypair(defaultPath);
    } catch {
      console.warn(`  ⚠️  Failed to load keypair at ${defaultPath}`);
    }
  }

  // 3. ADMIN_KEYPAIR (if it matches this admin pubkey)
  if (fallbackKp && fallbackKp.publicKey.equals(adminPubkey)) {
    return fallbackKp;
  }

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  printBanner("PERC-806 — Batch SetOracleAuthority");
  console.log("RPC:     ", RPC_URL.replace(/api-key=.+/, "api-key=***"));
  console.log("Program: ", SMALL_PROGRAM.toBase58());
  console.log("Keeper:  ", KEEPER_WALLET.toBase58());
  console.log("Dry run: ", dryRun);

  // ── Load optional single-admin keypair ────────────────────────────────────
  let fallbackKp: Keypair | null = null;
  if (process.env.ADMIN_KEYPAIR) {
    if (fs.existsSync(process.env.ADMIN_KEYPAIR)) {
      fallbackKp = loadKeypair(process.env.ADMIN_KEYPAIR);
      console.log("Admin:   ", fallbackKp.publicKey.toBase58(), "(from ADMIN_KEYPAIR)");
    } else {
      console.error(`❌ ADMIN_KEYPAIR file not found: ${process.env.ADMIN_KEYPAIR}`);
      process.exit(1);
    }
  }
  console.log();

  // ── Discover markets ──────────────────────────────────────────────────────
  const conn = new Connection(RPC_URL, "confirmed");
  console.log("Discovering markets on-chain…");
  const allMarkets = await discoverMarkets(conn, SMALL_PROGRAM);
  console.log(`Found ${allMarkets.length} total markets.\n`);

  // ── Filter: active markets where oracle_authority != KEEPER ──────────────
  type MarketInfo = {
    slabAddress: PublicKey;
    oracleAuthority: PublicKey;
    admin: PublicKey;
  };

  const mismatched: MarketInfo[] = [];
  let alreadyCorrect = 0;
  let pausedSkipped = 0;

  for (const m of allMarkets) {
    if (m.header.paused || m.header.resolved) {
      pausedSkipped++;
      continue;
    }
    if (m.config.oracleAuthority.equals(KEEPER_WALLET)) {
      alreadyCorrect++;
      continue;
    }
    mismatched.push({
      slabAddress: m.slabAddress,
      oracleAuthority: m.config.oracleAuthority,
      admin: m.header.admin ?? m.config.oracleAuthority, // fallback: treat oracle_authority as admin
    });
  }

  console.log("Breakdown:");
  console.log(`  ✅ Already correct (oracle_authority = keeper): ${alreadyCorrect}`);
  console.log(`  ❌ Need fixing (oracle_authority != keeper):    ${mismatched.length}`);
  console.log(`  ⏸️  Paused/resolved (skipped):                  ${pausedSkipped}`);

  if (mismatched.length === 0) {
    console.log("\n✅ All markets already have correct oracle_authority. Nothing to do.");
    return;
  }

  // ── Group by admin pubkey ─────────────────────────────────────────────────
  const byAdmin = new Map<string, MarketInfo[]>();
  for (const m of mismatched) {
    const adminStr = m.admin.toBase58();
    if (!byAdmin.has(adminStr)) byAdmin.set(adminStr, []);
    byAdmin.get(adminStr)!.push(m);
  }

  printBanner(`${mismatched.length} markets to fix — grouped by market admin`);

  const fixable: Array<{ kp: Keypair; market: MarketInfo }> = [];
  const unfixable: Array<{ adminPubkey: string; markets: MarketInfo[] }> = [];

  for (const [adminStr, markets] of byAdmin) {
    const adminPubkey = new PublicKey(adminStr);
    const kp = findKeypairForAdmin(adminPubkey, fallbackKp);
    const statusIcon = kp ? "🔑" : "🔒";
    console.log(`\n${statusIcon} Admin: ${adminStr} (${markets.length} market${markets.length > 1 ? "s" : ""})`);

    for (const m of markets) {
      const current = m.oracleAuthority.toBase58();
      const label =
        current === "11111111111111111111111111111111"
          ? "PublicKey.default (unset)"
          : current;
      console.log(`     slab=${m.slabAddress.toBase58()}  current_authority=${label}`);
    }

    if (kp) {
      console.log(`     ✅ Keypair available — will fix`);
      for (const m of markets) fixable.push({ kp, market: m });
    } else {
      console.log(`     ❌ Keypair NOT found — use /admin UI (PR #1244) or provide keypair`);
      unfixable.push({ adminPubkey: adminStr, markets });
    }
  }

  console.log(`\n📊 Summary: ${fixable.length} fixable now, ${mismatched.length - fixable.length} need manual action`);

  if (dryRun) {
    console.log("\n🔍 DRY RUN — no transactions sent.");
    if (fixable.length > 0) {
      console.log(`   ${fixable.length} markets would be fixed immediately.`);
    }
    if (unfixable.length > 0) {
      console.log("\n⚠️  Markets still needing human action:");
      for (const { adminPubkey, markets } of unfixable) {
        console.log(`   Admin ${adminPubkey} — ${markets.length} market${markets.length > 1 ? "s" : ""}`);
        console.log(`     → Share /admin page with this wallet so they can self-serve`);
      }
    }
    console.log("\n   Re-run without --dry-run (with ADMIN_KEYPAIR/KEYPAIR_DIR set) to execute.");
    return;
  }

  if (fixable.length === 0) {
    console.log("\n⚠️  No fixable markets (no matching keypairs loaded). Aborting.");
    console.log("   Provide keypairs via ADMIN_KEYPAIR or KEYPAIR_DIR.");
    process.exit(0);
  }

  // ── Execute in batches ────────────────────────────────────────────────────
  printBanner(`Executing ${fixable.length} SetOracleAuthority transactions`);

  let succeeded = 0;
  let failed = 0;
  const failedSlabs: string[] = [];

  for (let i = 0; i < fixable.length; i += BATCH_SIZE) {
    const batch = fixable.slice(i, i + BATCH_SIZE);
    console.log(
      `\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(fixable.length / BATCH_SIZE)} ` +
        `(#${i + 1}–${i + batch.length})`
    );

    for (const { kp, market } of batch) {
      const slabPubkey = market.slabAddress;
      const slabShort = slabPubkey.toBase58().slice(0, 8);
      const adminShort = kp.publicKey.toBase58().slice(0, 8);

      const data = encodeSetOracleAuthority({ newAuthority: KEEPER_WALLET });
      const keys = buildAccountMetas(ACCOUNTS_SET_ORACLE_AUTHORITY, [
        kp.publicKey,  // admin (signer)
        slabPubkey,    // slab (writable)
      ]);

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        buildIx({ programId: SMALL_PROGRAM, keys, data })
      );

      try {
        const sig = await sendAndConfirmTransaction(conn, tx, [kp], {
          commitment: "confirmed",
        });
        console.log(`  ✅ slab=${slabShort}… admin=${adminShort}…  sig=${sig.slice(0, 12)}…`);
        console.log(`     https://explorer.solana.com/tx/${sig}?cluster=devnet`);
        succeeded++;
      } catch (err) {
        const e = err as Error & { logs?: string[] };
        console.log(`  ❌ slab=${slabShort}… error=${e.message.slice(0, 80)}`);
        if (e.logs) {
          console.log(`     logs=${e.logs.slice(-2).join(" | ")}`);
        }
        failed++;
        failedSlabs.push(slabPubkey.toBase58());
      }
    }

    if (i + BATCH_SIZE < fixable.length) {
      console.log(`\n  … pausing ${BATCH_DELAY_MS}ms …`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ── Final report ──────────────────────────────────────────────────────────
  printBanner("Final Report");
  console.log(`Attempted:  ${fixable.length}`);
  console.log(`Succeeded:  ${succeeded}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Skipped:    ${mismatched.length - fixable.length} (no keypair)`);

  if (failedSlabs.length > 0) {
    console.log("\nFailed slabs:");
    for (const s of failedSlabs) console.log(`  ${s}`);
  }

  if (unfixable.length > 0) {
    printBanner("⚠️  Markets Still Needing Manual Action");
    console.log("These markets need their creator to visit /admin and self-delegate:");
    for (const { adminPubkey, markets } of unfixable) {
      console.log(`\n  Admin: ${adminPubkey}`);
      for (const m of markets) {
        console.log(`    slab=${m.slabAddress.toBase58()}`);
      }
    }
    console.log(
      "\n  → Share the /admin page URL with these wallets, or\n" +
        "  → If you have access to these keypairs, add them to KEYPAIR_DIR and rerun."
    );
  }

  if (succeeded > 0 && failed === 0 && unfixable.length === 0) {
    console.log(
      `\n✅ All done! Oracle-keeper (${KEEPER_WALLET.toBase58()}) can now\n` +
        `   push prices for all previously stuck markets.`
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
