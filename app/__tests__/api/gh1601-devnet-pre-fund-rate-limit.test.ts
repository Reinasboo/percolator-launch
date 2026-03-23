/**
 * GH#1601: Per-wallet rate limit for /api/devnet-pre-fund
 *
 * Tests that the tryFaucetGate call prevents concurrent same-wallet+mint
 * requests from all passing through to the on-chain mintTo instruction.
 *
 * We test the gate integration in isolation (no live Solana RPC needed).
 */

import { describe, it, expect } from "vitest";

interface GateResult {
  allowed: boolean;
  nextClaimAt: string | null;
  claimId?: number;
}

// Simulates the per-wallet gate flow from devnet-pre-fund/route.ts
async function simulatePreFund(
  wallet: string,
  mintAddress: string,
  tryFaucetGate: (wallet: string, fundType: string) => Promise<GateResult>,
  doMint: () => Promise<{ sig: string }>,
  releaseClaim: (id: number) => Promise<void>,
): Promise<
  | { status: "funded"; sig: string }
  | { status: "sufficient" }
  | { status: "rate_limited"; nextClaimAt: string | null }
  | { status: "error"; message: string }
> {
  const fundType = `devnet-pre-fund:${mintAddress}`;
  const gate = await tryFaucetGate(wallet, fundType);
  if (!gate.allowed) {
    return { status: "rate_limited", nextClaimAt: gate.nextClaimAt };
  }

  try {
    const { sig } = await doMint();
    return { status: "funded", sig };
  } catch (err) {
    if (gate.claimId != null) await releaseClaim(gate.claimId);
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

describe("GH#1601: devnet-pre-fund per-wallet rate limit", () => {
  it("allows first request through", async () => {
    const tryFaucetGate = async () => ({ allowed: true, nextClaimAt: null, claimId: 1 });
    const doMint = async () => ({ sig: "SIG_1" });
    const releaseClaim = async () => {};

    const result = await simulatePreFund("WALLET_A", "MINT_X", tryFaucetGate, doMint, releaseClaim);
    expect(result.status).toBe("funded");
    if (result.status === "funded") expect(result.sig).toBe("SIG_1");
  });

  it("blocks second request within rate window (23505 from gate)", async () => {
    const nextClaimAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const tryFaucetGate = async () => ({ allowed: false, nextClaimAt, claimId: undefined });
    const doMint = async () => ({ sig: "SHOULD_NOT_REACH" });
    const releaseClaim = async () => {};

    const result = await simulatePreFund("WALLET_A", "MINT_X", tryFaucetGate, doMint, releaseClaim);
    expect(result.status).toBe("rate_limited");
    if (result.status === "rate_limited") expect(result.nextClaimAt).toBe(nextClaimAt);
  });

  it("releases gate on mint failure so user can retry", async () => {
    let released = false;
    const tryFaucetGate = async () => ({ allowed: true, nextClaimAt: null, claimId: 42 });
    const doMint = async () => { throw new Error("tx timeout"); };
    const releaseClaim = async (id: number) => {
      expect(id).toBe(42);
      released = true;
    };

    const result = await simulatePreFund("WALLET_A", "MINT_X", tryFaucetGate, doMint, releaseClaim);
    expect(result.status).toBe("error");
    expect(released).toBe(true);
  });

  it("gate is per-wallet (different wallets allowed concurrently)", async () => {
    const claims = new Map<string, number>();
    let claimIdSeq = 0;
    const tryFaucetGate = async (wallet: string, fundType: string) => {
      const key = `${wallet}:${fundType}`;
      if (claims.has(key)) {
        return { allowed: false, nextClaimAt: new Date().toISOString() };
      }
      claims.set(key, ++claimIdSeq);
      return { allowed: true, nextClaimAt: null, claimId: claimIdSeq };
    };
    const doMint = async () => ({ sig: "SIG_OK" });
    const releaseClaim = async () => {};

    const [r1, r2] = await Promise.all([
      simulatePreFund("WALLET_A", "MINT_X", tryFaucetGate, doMint, releaseClaim),
      simulatePreFund("WALLET_B", "MINT_X", tryFaucetGate, doMint, releaseClaim),
    ]);
    // Both wallets funded independently
    expect(r1.status).toBe("funded");
    expect(r2.status).toBe("funded");
  });

  it("gate is per-mint (same wallet, different mints allowed concurrently)", async () => {
    const claims = new Map<string, number>();
    let claimIdSeq = 0;
    const tryFaucetGate = async (wallet: string, fundType: string) => {
      const key = `${wallet}:${fundType}`;
      if (claims.has(key)) {
        return { allowed: false, nextClaimAt: new Date().toISOString() };
      }
      claims.set(key, ++claimIdSeq);
      return { allowed: true, nextClaimAt: null, claimId: claimIdSeq };
    };
    const doMint = async () => ({ sig: "SIG_OK" });
    const releaseClaim = async () => {};

    const [r1, r2] = await Promise.all([
      simulatePreFund("WALLET_A", "MINT_X", tryFaucetGate, doMint, releaseClaim),
      simulatePreFund("WALLET_A", "MINT_Y", tryFaucetGate, doMint, releaseClaim),
    ]);
    // Same wallet, different mints — both allowed
    expect(r1.status).toBe("funded");
    expect(r2.status).toBe("funded");
  });

  it("same wallet + same mint: concurrent requests — exactly one funded, one rate-limited", async () => {
    const claims = new Map<string, number>();
    let claimIdSeq = 0;
    const tryFaucetGate = async (wallet: string, fundType: string) => {
      const key = `${wallet}:${fundType}`;
      if (claims.has(key)) {
        return { allowed: false, nextClaimAt: new Date().toISOString() };
      }
      claims.set(key, ++claimIdSeq);
      return { allowed: true, nextClaimAt: null, claimId: claimIdSeq };
    };
    const doMint = async () => ({ sig: "SIG_OK" });
    const releaseClaim = async () => {};

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        simulatePreFund("WALLET_A", "MINT_X", tryFaucetGate, doMint, releaseClaim),
      ),
    );
    const funded = results.filter((r) => r.status === "funded");
    const limited = results.filter((r) => r.status === "rate_limited");
    expect(funded).toHaveLength(1);
    expect(limited).toHaveLength(4);
  });
});
