/**
 * GH#1600: TOCTOU race in /api/devnet-mint-token
 *
 * Tests that the INSERT-as-gate pattern handles the race condition
 * where concurrent requests for the same mainnetCA both pass the SELECT check.
 *
 * We test the DB-insert logic in isolation since the full route involves
 * Solana on-chain operations that require a live connection.
 */

import { describe, it, expect } from "vitest";

// Simulates the INSERT-as-gate behavior from devnet-mint-token/route.ts
async function simulateInsert(
  supabase: {
    insert: (row: Record<string, unknown>) => Promise<{ error: { code: string; message: string } | null }>;
    selectWinner: (mainnetCA: string) => Promise<string | null>;
  },
  mainnetCA: string,
  devnetMint: string,
  symbol: string,
) {
  const { error: insertErr } = await supabase.insert({ mainnet_ca: mainnetCA, devnet_mint: devnetMint, symbol });

  if (insertErr?.code === "23505") {
    const winner = await supabase.selectWinner(mainnetCA);
    return {
      status: "already_exists" as const,
      devnetMint: winner ?? devnetMint,
      symbol,
    };
  }
  if (insertErr) {
    throw new Error(`DB insert failed: ${insertErr.message}`);
  }
  return { status: "created" as const, devnetMint, symbol };
}

describe("GH#1600: devnet-mint-token INSERT-as-gate TOCTOU logic", () => {
  it("returns created when INSERT succeeds (race winner)", async () => {
    const supabase = {
      insert: async () => ({ error: null }),
      selectWinner: async () => null,
    };
    const result = await simulateInsert(supabase, "MAINNET_CA_1", "DEVNET_MINT_A", "SOL");
    expect(result.status).toBe("created");
    expect(result.devnetMint).toBe("DEVNET_MINT_A");
  });

  it("returns already_exists with winner mint on 23505 (race loser)", async () => {
    const supabase = {
      insert: async () => ({ error: { code: "23505", message: "duplicate key" } }),
      selectWinner: async (_ca: string) => "DEVNET_MINT_WINNER",
    };
    const result = await simulateInsert(supabase, "MAINNET_CA_1", "DEVNET_MINT_LOSER", "SOL");
    expect(result.status).toBe("already_exists");
    expect(result.devnetMint).toBe("DEVNET_MINT_WINNER");
  });

  it("falls back to own mint when winner lookup returns null", async () => {
    const supabase = {
      insert: async () => ({ error: { code: "23505", message: "duplicate key" } }),
      selectWinner: async (_ca: string) => null,
    };
    const result = await simulateInsert(supabase, "MAINNET_CA_1", "DEVNET_MINT_FALLBACK", "SOL");
    expect(result.status).toBe("already_exists");
    expect(result.devnetMint).toBe("DEVNET_MINT_FALLBACK");
  });

  it("throws on unexpected DB error (not 23505)", async () => {
    const supabase = {
      insert: async () => ({ error: { code: "42501", message: "permission denied" } }),
      selectWinner: async (_ca: string) => null,
    };
    await expect(simulateInsert(supabase, "MAINNET_CA_1", "DEVNET_MINT_X", "SOL")).rejects.toThrow(
      "DB insert failed: permission denied",
    );
  });

  it("simulates true concurrent race: second INSERT gets 23505 and returns winner", async () => {
    const db = new Map<string, string>(); // mainnet_ca → devnet_mint
    let callCount = 0;

    const makeSupabase = (ownMint: string) => ({
      insert: async (row: Record<string, unknown>) => {
        callCount++;
        const ca = row["mainnet_ca"] as string;
        if (db.has(ca)) {
          return { error: { code: "23505", message: "duplicate key" } };
        }
        db.set(ca, row["devnet_mint"] as string);
        return { error: null };
      },
      selectWinner: async (ca: string) => db.get(ca) ?? null,
    });

    const [r1, r2] = await Promise.all([
      simulateInsert(makeSupabase("MINT_A"), "SAME_CA", "MINT_A", "TKN"),
      simulateInsert(makeSupabase("MINT_B"), "SAME_CA", "MINT_B", "TKN"),
    ]);

    // Exactly one winner, one loser
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual(["already_exists", "created"]);

    // Both end up pointing to the same (winner's) devnet mint
    expect(r1.devnetMint).toBe(r2.devnetMint);
    expect(callCount).toBe(2);
  });
});
