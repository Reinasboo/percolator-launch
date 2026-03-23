/**
 * PERC-363: Token airdrop endpoint
 *
 * POST /api/airdrop { marketAddress: string, walletAddress: string }
 *
 * Airdrops $500 USD worth of the market's devnet token to the wallet.
 * Rate limited: 1 claim per wallet per market per 24h.
 *
 * GH#1586 fix: if the stored mint was NOT created by DEVNET_MINT_AUTHORITY_KEYPAIR
 * (OwnerMismatch 0x4 would result), fall back to a server-owned mirror mint for
 * that market. If none exists, create one on-the-fly and record it in devnet_mints.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import { getConfig } from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";
import { getDevnetMintSigner } from "@/lib/devnet-signer";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

// GH#1571: align with canonical env var (NEXT_PUBLIC_DEFAULT_NETWORK), fallback to legacy name
const NETWORK =
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK?.trim() ??
  process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim();
const AIRDROP_USD_VALUE = 500;
const RATE_LIMIT_HOURS = 24;
const MIN_SOL_THRESHOLD = 0.01 * LAMPORTS_PER_SOL;
const REFILL_SOL = 2;

/**
 * GH#1586: Given a market's stored mintAddress, verify that the server keypair
 * actually owns the mint authority on-chain. If not, look for a server-owned
 * mirror mint in devnet_mints for this market, or create one fresh.
 *
 * Returns the mint address that the server keypair can MintTo.
 */
async function resolveServerOwnedMint(
  connection: Connection,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  marketAddress: string,
  storedMint: string,
  mintAuthPubkey: string,
  mintSigner: ReturnType<typeof getDevnetMintSigner>,
  decimals: number,
): Promise<string> {
  // 1. Check if storedMint's authority === our server key
  try {
    const mintInfo = await getMint(connection, new PublicKey(storedMint));
    if (mintInfo.mintAuthority?.toBase58() === mintAuthPubkey) {
      // Server owns this mint — use it as-is
      return storedMint;
    }
  } catch (e) {
    // Mint account might not exist or be unreadable; fall through to create a new one
    console.warn(`airdrop: getMint failed for ${storedMint}: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Server does NOT own storedMint. Look for a server-owned mirror in devnet_mints.
  const { data: mirror } = await supabase
    .from("devnet_mints")
    .select("devnet_mint")
    .eq("market_address", marketAddress)
    .eq("creator_wallet", mintAuthPubkey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mirror?.devnet_mint) {
    // Sanity-check on-chain too (fast path: trust DB)
    return mirror.devnet_mint as string;
  }

  // 3. No server-owned mirror exists — create one now.
  // This is the "legacy market" case: market was created by a different wallet.
  console.info(
    `airdrop: creating server-owned mirror mint for market ${marketAddress} ` +
    `(stored mint ${storedMint} has different authority)`,
  );

  if (!mintSigner) {
    throw new Error("Server not configured for minting (DEVNET_MINT_AUTHORITY_KEYPAIR missing)");
  }

  const mintAuthPk = new PublicKey(mintSigner.publicKey());
  const mintKeypair = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const { blockhash } = await connection.getLatestBlockhash();

  const createTx = new Transaction();
  createTx.recentBlockhash = blockhash;
  createTx.feePayer = mintAuthPk;

  createTx.add(
    SystemProgram.createAccount({
      fromPubkey: mintAuthPk,
      newAccountPubkey: mintKeypair.publicKey,
      lamports,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  createTx.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      mintAuthPk, // mint authority = server keypair
      mintAuthPk, // freeze authority = server keypair
    ),
  );

  // Multi-signer: mintKeypair signs first, then server signs via sealed signer
  createTx.partialSign(mintKeypair);
  const signedTx = mintSigner.signTransaction(createTx) as Transaction;
  const createSig = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(createSig, "confirmed");

  const newMint = mintKeypair.publicKey.toBase58();

  // Store in devnet_mints keyed by market_address so future requests find it
  await supabase.from("devnet_mints").upsert(
    {
      mainnet_ca: `__market_mirror__${marketAddress}`, // synthetic key for market-owned mirrors
      devnet_mint: newMint,
      market_address: marketAddress,
      symbol: "TOKEN", // will be overwritten by real symbol on next market info fetch
      name: `Mirror ${marketAddress.slice(0, 6)}`,
      decimals,
      creator_wallet: mintAuthPubkey,
    },
    { onConflict: "mainnet_ca", ignoreDuplicates: true },
  );

  // Also update the markets table so future lookups get the server-owned mint directly
  const { error: upsertErr } = await supabase.from("markets").update(
    { mint_address: newMint },
  ).eq("slab_address", marketAddress);
  if (upsertErr) {
    console.warn(`airdrop: markets.mint_address update failed (non-fatal): ${upsertErr.message}`);
  }

  console.info(`airdrop: created server-owned mirror mint ${newMint} for market ${marketAddress}. sig=${createSig}`);
  return newMint;
}

export async function POST(req: NextRequest) {
  try {
    if (NETWORK !== "devnet") {
      return NextResponse.json({ error: "Only available on devnet" }, { status: 403 });
    }

    const body = await req.json();
    const { marketAddress, walletAddress } = body;

    if (!marketAddress || !walletAddress) {
      return NextResponse.json({ error: "Missing marketAddress or walletAddress" }, { status: 400 });
    }

    let walletPk: PublicKey;
    try { walletPk = new PublicKey(walletAddress); } catch {
      return NextResponse.json({ error: "Invalid walletAddress" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Rate limit check
    const cutoff = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recent } = await (supabase as any)
      .from("airdrop_claims")
      .select("id")
      .eq("wallet", walletAddress)
      .eq("market_address", marketAddress)
      .gte("claimed_at", cutoff)
      .limit(1);

    if (recent && recent.length > 0) {
      // Calculate time remaining
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lastClaim } = await (supabase as any)
        .from("airdrop_claims")
        .select("claimed_at")
        .eq("wallet", walletAddress)
        .eq("market_address", marketAddress)
        .order("claimed_at", { ascending: false })
        .limit(1)
        .single();

      const nextClaimAt = lastClaim
        ? new Date(new Date(lastClaim.claimed_at).getTime() + RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString()
        : null;

      return NextResponse.json(
        { error: "Already claimed in the last 24 hours", nextClaimAt },
        { status: 429 },
      );
    }

    // Look up the devnet mint for this market (try markets table first, then devnet_mints)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: marketData } = await (supabase as any)
      .from("markets")
      .select("mint_address, symbol")
      .eq("slab_address", marketAddress)
      .maybeSingle();

    let mintAddress: string | null = marketData?.mint_address ?? null;
    let symbol: string = marketData?.symbol ?? "TOKEN";

    // Fallback to devnet_mints table if markets table doesn't have the mint
    if (!mintAddress) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: devnetMintData, error: fallbackErr } = await (supabase as any)
        .from("devnet_mints")
        .select("devnet_mint, symbol")
        .eq("market_address", marketAddress)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackErr) {
        console.warn("airdrop: devnet_mints fallback query failed:", fallbackErr.message);
      }

      if (devnetMintData?.devnet_mint) {
        mintAddress = devnetMintData.devnet_mint;
        symbol = devnetMintData.symbol ?? symbol;
      }
    }

    if (!mintAddress) {
      return NextResponse.json({ error: "Market not found — no devnet mint exists for this market" }, { status: 404 });
    }

    // Get current price from oracle bridge
    let priceUsd = 1.0; // fallback
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: stats } = await (supabase as any)
        .from("markets_with_stats")
        .select("last_price")
        .eq("slab_address", marketAddress)
        .maybeSingle();

      if (stats?.last_price && stats.last_price > 0) {
        priceUsd = stats.last_price;
      }
    } catch {}

    // Load mint authority via sealed signer (consistent with devnet-mint-token and devnet-mirror-mint)
    const mintSigner = getDevnetMintSigner();
    if (!mintSigner) {
      return NextResponse.json(
        { error: "Server not configured for minting" },
        { status: 500 },
      );
    }
    const mintAuthPubkey = mintSigner.publicKey();
    const mintAuthPk = new PublicKey(mintAuthPubkey);

    const cfg = getConfig();
    const connection = new Connection(cfg.rpcUrl, "confirmed");

    // GH#1583: Ensure mint authority has enough SOL to create ATAs (~0.002 SOL each).
    try {
      const mintAuthBalance = await connection.getBalance(mintAuthPk);
      if (mintAuthBalance < MIN_SOL_THRESHOLD) {
        console.warn(
          `airdrop: mint authority balance low (${mintAuthBalance} lamports). Requesting devnet airdrop...`,
        );
        const sig = await connection.requestAirdrop(mintAuthPk, REFILL_SOL * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        console.info(`airdrop: mint authority refilled. sig=${sig}`);
      }
    } catch (refillErr) {
      console.warn(
        `airdrop: could not auto-refill mint authority: ${refillErr instanceof Error ? refillErr.message : refillErr}`,
      );
    }

    const decimals = 6; // Standard for devnet mirrors

    // GH#1586: Resolve a mint that the server keypair actually owns.
    // Many legacy markets were created by different deployer wallets — their mints
    // have a different authority and MintTo returns 0x4 OwnerMismatch.
    // resolveServerOwnedMint checks on-chain, falls back to a DB mirror, or creates
    // a new server-owned mint and updates the markets table for future requests.
    let resolvedMint: string;
    try {
      resolvedMint = await resolveServerOwnedMint(
        connection,
        supabase,
        marketAddress,
        mintAddress,
        mintAuthPubkey,
        mintSigner,
        decimals,
      );
    } catch (resolveErr) {
      Sentry.captureException(resolveErr, {
        tags: { endpoint: "/api/airdrop", step: "resolveServerOwnedMint" },
        extra: { marketAddress, mintAddress, mintAuthPubkey },
      });
      return NextResponse.json(
        { error: resolveErr instanceof Error ? resolveErr.message : "Failed to resolve mint authority" },
        { status: 500 },
      );
    }

    const mintPk = new PublicKey(resolvedMint);

    // Calculate airdrop amount
    const tokensFloat = AIRDROP_USD_VALUE / priceUsd;
    const airdropAmount = BigInt(Math.floor(tokensFloat * 10 ** decimals));

    const tx = new Transaction();

    // Create ATA if needed
    const ata = await getAssociatedTokenAddress(mintPk, walletPk);
    try {
      await connection.getTokenAccountBalance(ata);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          mintAuthPk,
          ata,
          walletPk,
          mintPk,
        ),
      );
    }

    // Mint tokens
    tx.add(
      createMintToInstruction(
        mintPk,
        ata,
        mintAuthPk,
        airdropAmount,
      ),
    );

    // Set blockhash and feePayer before signing
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = mintAuthPk;

    const signedTx = mintSigner.signTransaction(tx) as Transaction;
    const sig = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    // Record claim
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("airdrop_claims").insert({
      wallet: walletAddress,
      market_address: marketAddress,
      amount_tokens: tokensFloat,
      amount_usd: AIRDROP_USD_VALUE,
      signature: sig,
    });

    return NextResponse.json({
      status: "airdropped",
      symbol,
      tokens: tokensFloat,
      usdValue: AIRDROP_USD_VALUE,
      signature: sig,
      nextClaimAt: new Date(Date.now() + RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { endpoint: "/api/airdrop", method: "POST" },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
