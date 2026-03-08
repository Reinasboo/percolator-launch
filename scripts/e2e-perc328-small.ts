/**
 * PERC-328 smoke test — Small tier
 * Program: FwfBKZXbYr4vTK23bMFkbgKq3npJ3MSDxEaKmq9Aj4Qn
 */
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  sendAndConfirmTransaction, ComputeBudgetProgram, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction, createAssociatedTokenAccountInstruction,
  createMintToInstruction, createTransferInstruction,
  getAssociatedTokenAddress, getMinimumBalanceForRentExemptMint,
  MINT_SIZE, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import {
  encodeInitMarket, encodeInitLP, encodeInitUser, encodeDepositCollateral,
  encodeTopUpInsurance, encodeKeeperCrank, encodeSetOracleAuthority,
  encodePushOraclePrice, encodeTradeCpi, encodeWithdrawCollateral,
  ACCOUNTS_INIT_MARKET, ACCOUNTS_INIT_LP, ACCOUNTS_INIT_USER,
  ACCOUNTS_DEPOSIT_COLLATERAL, ACCOUNTS_TOPUP_INSURANCE, ACCOUNTS_KEEPER_CRANK,
  ACCOUNTS_SET_ORACLE_AUTHORITY, ACCOUNTS_PUSH_ORACLE_PRICE, ACCOUNTS_TRADE_CPI,
  ACCOUNTS_WITHDRAW_COLLATERAL,
  buildAccountMetas, buildIx, WELL_KNOWN, deriveVaultAuthority, deriveLpPda, SLAB_TIERS,
} from "@percolator/sdk";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("FwfBKZXbYr4vTK23bMFkbgKq3npJ3MSDxEaKmq9Aj4Qn"); // Small
const MATCHER_PROGRAM_ID = new PublicKey("GTRgyTDfrMvBubALAqtHuQwT8tbGyXid7svXZKtWfC9k");
const MATCHER_CTX_SIZE = 320;
const tier = SLAB_TIERS.small;

const conn = new Connection(RPC, "confirmed");
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("/tmp/deployer.json", "utf-8")))
);

let passed = 0; let failed = 0;
function ok(label: string) { console.log(`  ✅ ${label}`); passed++; }
function fail(label: string, err: any) { console.error(`  ❌ ${label}:`, err instanceof Error ? err.message : String(err)); failed++; }

async function send(tx: Transaction, signers: Keypair[], label: string): Promise<string> {
  tx.feePayer = payer.publicKey;
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  const sig = await sendAndConfirmTransaction(conn, tx, signers, { commitment: "confirmed" });
  ok(`${label} → ${sig.slice(0, 12)}...`);
  return sig;
}

async function main() {
  console.log("🧪 PERC-328 Smoke Test — Small tier");
  console.log(`   Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`   Payer: ${payer.publicKey.toBase58()}`);
  const bal = await conn.getBalance(payer.publicKey);
  console.log(`   Balance: ${bal / LAMPORTS_PER_SOL} SOL`);
  console.log(`   Tier: ${tier.label} (${tier.dataSize} bytes, ${tier.maxAccounts} accounts)`);
  console.log("");

  // 1. Create SPL token mint
  console.log("Step 1: Create token mint");
  const mintKp = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(conn);
  await send(new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mintKp.publicKey, lamports: mintRent, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
    createInitializeMintInstruction(mintKp.publicKey, 9, payer.publicKey, payer.publicKey)
  ), [payer, mintKp], `Mint: ${mintKp.publicKey.toBase58().slice(0,8)}...`);

  // 2. Mint tokens
  console.log("Step 2: Mint tokens");
  const payerAta = await getAssociatedTokenAddress(mintKp.publicKey, payer.publicKey);
  await send(new Transaction().add(
    createAssociatedTokenAccountInstruction(payer.publicKey, payerAta, payer.publicKey, mintKp.publicKey),
    createMintToInstruction(mintKp.publicKey, payerAta, payer.publicKey, 10_000_000_000_000n)
  ), [payer], "Minted 10K tokens");

  // 3. Create slab
  console.log("Step 3: Create slab (small)");
  const slabKp = Keypair.generate();
  const slabRent = await conn.getMinimumBalanceForRentExemption(tier.dataSize);
  console.log(`   Slab rent: ${(slabRent / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: slabKp.publicKey, lamports: slabRent, space: tier.dataSize, programId: PROGRAM_ID })
  ), [payer, slabKp], `Slab: ${slabKp.publicKey.toBase58().slice(0,8)}...`);

  // 4. Vault ATA + seed
  console.log("Step 4: Vault ATA + seed");
  const [vaultPda] = deriveVaultAuthority(PROGRAM_ID, slabKp.publicKey);
  const vaultAta = await getAssociatedTokenAddress(mintKp.publicKey, vaultPda, true);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
    createAssociatedTokenAccountInstruction(payer.publicKey, vaultAta, vaultPda, mintKp.publicKey)
  ), [payer], "Vault ATA");
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
    createTransferInstruction(payerAta, vaultAta, payer.publicKey, 1_000_000_000n)
  ), [payer], "Seed vault");

  // 5. InitMarket
  console.log("Step 5: InitMarket");
  const initMarketData = encodeInitMarket({
    admin: payer.publicKey, collateralMint: mintKp.publicKey,
    indexFeedId: "0".repeat(64), maxStalenessSecs: "50", confFilterBps: 0,
    invert: 0, unitScale: 0, initialMarkPriceE6: "1000000", warmupPeriodSlots: "0",
    maintenanceMarginBps: "500", initialMarginBps: "1000", tradingFeeBps: "30",
    maxAccounts: tier.maxAccounts.toString(), newAccountFee: "1000000",
    riskReductionThreshold: "0", maintenanceFeePerSlot: "0",
    maxCrankStalenessSlots: "100", liquidationFeeBps: "100", liquidationFeeCap: "0",
    liquidationBufferBps: "50", minLiquidationAbs: "0",
  });
  const initMarketKeys = buildAccountMetas(ACCOUNTS_INIT_MARKET, [
    payer.publicKey, slabKp.publicKey, mintKp.publicKey, vaultAta,
    WELL_KNOWN.tokenProgram, WELL_KNOWN.clock, WELL_KNOWN.rent, vaultPda, WELL_KNOWN.systemProgram,
  ]);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: initMarketKeys, data: initMarketData })
  ), [payer], "InitMarket ✓");

  // 6. Matcher ctx + InitLP
  console.log("Step 6: InitLP");
  const matcherCtxKp = Keypair.generate();
  const matcherRent = await conn.getMinimumBalanceForRentExemption(MATCHER_CTX_SIZE);
  const [lpPda] = deriveLpPda(PROGRAM_ID, slabKp.publicKey, 0);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: matcherCtxKp.publicKey, lamports: matcherRent, space: MATCHER_CTX_SIZE, programId: MATCHER_PROGRAM_ID })
  ), [payer, matcherCtxKp], "Matcher ctx");
  const initLpData = encodeInitLP({ matcherProgram: MATCHER_PROGRAM_ID, matcherContext: matcherCtxKp.publicKey, feePayment: "1000000" });
  const initLpKeys = buildAccountMetas(ACCOUNTS_INIT_LP, [payer.publicKey, slabKp.publicKey, payerAta, vaultAta, WELL_KNOWN.tokenProgram]);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: initLpKeys, data: initLpData })
  ), [payer], "InitLP");

  // 7. Deposit + Insurance
  console.log("Step 7: Deposit + Insurance");
  const depositKeys = buildAccountMetas(ACCOUNTS_DEPOSIT_COLLATERAL, [payer.publicKey, slabKp.publicKey, payerAta, vaultAta, WELL_KNOWN.tokenProgram, WELL_KNOWN.clock]);
  const topupKeys = buildAccountMetas(ACCOUNTS_TOPUP_INSURANCE, [payer.publicKey, slabKp.publicKey, payerAta, vaultAta, WELL_KNOWN.tokenProgram]);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: depositKeys, data: encodeDepositCollateral({ userIdx: 0, amount: "1000000000000" }) }),
    buildIx({ programId: PROGRAM_ID, keys: topupKeys, data: encodeTopUpInsurance({ amount: "100000000000" }) })
  ), [payer], "Deposit 1000 + Insurance 100");

  // 8. Oracle + Crank
  console.log("Step 8: Oracle + Crank");
  const setAuthKeys = buildAccountMetas(ACCOUNTS_SET_ORACLE_AUTHORITY, [payer.publicKey, slabKp.publicKey]);
  const pushKeys = buildAccountMetas(ACCOUNTS_PUSH_ORACLE_PRICE, [payer.publicKey, slabKp.publicKey]);
  const crankKeys = buildAccountMetas(ACCOUNTS_KEEPER_CRANK, [payer.publicKey, slabKp.publicKey, WELL_KNOWN.clock, slabKp.publicKey]);
  const now = Math.floor(Date.now() / 1000);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: setAuthKeys, data: encodeSetOracleAuthority({ newAuthority: payer.publicKey }) }),
    buildIx({ programId: PROGRAM_ID, keys: pushKeys, data: encodePushOraclePrice({ priceE6: "1000000", timestamp: now.toString() }) }),
    buildIx({ programId: PROGRAM_ID, keys: crankKeys, data: encodeKeeperCrank({ callerIdx: 65535, allowPanic: false }) })
  ), [payer], "SetOracleAuth + PushPrice + Crank");

  // 9. InitUser
  console.log("Step 9: InitUser");
  const initUserKeys = buildAccountMetas(ACCOUNTS_INIT_USER, [payer.publicKey, slabKp.publicKey, payerAta, vaultAta, WELL_KNOWN.tokenProgram]);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: initUserKeys, data: encodeInitUser({ feePayment: "1000000" }) })
  ), [payer], "InitUser");

  // 10. Trader deposit
  console.log("Step 10: Trader deposit");
  const traderDepositKeys = buildAccountMetas(ACCOUNTS_DEPOSIT_COLLATERAL, [payer.publicKey, slabKp.publicKey, payerAta, vaultAta, WELL_KNOWN.tokenProgram, WELL_KNOWN.clock]);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: traderDepositKeys, data: encodeDepositCollateral({ userIdx: 1, amount: "500000000000" }) })
  ), [payer], "Deposit 500 to trader");

  // 11. Open position (TradeCpi)
  console.log("Step 11: Open long position");
  const tradeKeys = buildAccountMetas(ACCOUNTS_TRADE_CPI, [
    payer.publicKey, payer.publicKey, slabKp.publicKey, slabKp.publicKey,
    MATCHER_PROGRAM_ID, matcherCtxKp.publicKey, lpPda,
  ]);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: tradeKeys, data: encodeTradeCpi({ lpIdx: 0, userIdx: 1, size: "100000000" }) })
  ), [payer], "TradeCpi — opened long");

  // 12. Crank post-trade
  console.log("Step 12: Crank post-trade");
  const now2 = Math.floor(Date.now() / 1000);
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: pushKeys, data: encodePushOraclePrice({ priceE6: "1000000", timestamp: now2.toString() }) }),
    buildIx({ programId: PROGRAM_ID, keys: crankKeys, data: encodeKeeperCrank({ callerIdx: 65535, allowPanic: false }) })
  ), [payer], "PushPrice + Crank (post-trade)");

  // 13. Close position (TradeCpi size=0 or negative)
  console.log("Step 13: Close position");
  await send(new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    buildIx({ programId: PROGRAM_ID, keys: tradeKeys, data: encodeTradeCpi({ lpIdx: 0, userIdx: 1, size: "-100000000" }) })
  ), [payer], "TradeCpi — closed position");

  const finalBal = await conn.getBalance(payer.publicKey);
  const cost = (bal - finalBal) / LAMPORTS_PER_SOL;
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  console.log(`   SOL spent: ${cost.toFixed(4)} SOL`);
  console.log(`   Slab: ${slabKp.publicKey.toBase58()}`);
  if (failed === 0) {
    console.log("\n🎉 PERC-328 Small tier — ALL STEPS PASSED");
  } else {
    console.log("\n💀 PERC-328 Small tier — FAILURES DETECTED");
    process.exit(1);
  }
}

main().catch(e => { console.error("\n💀 Fatal:", e.message || e); process.exit(1); });
