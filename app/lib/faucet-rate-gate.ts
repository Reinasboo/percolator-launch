/**
 * GH#1595: INSERT-as-gate rate limiter for faucet + auto-fund.
 *
 * Uses the `faucet_claims` table with UNIQUE(wallet, fund_type).
 * Concurrent requests race on INSERT — exactly one wins, others get 23505.
 * Eliminates the SELECT→INSERT TOCTOU window.
 *
 * Same pattern as tryAirdropClaimGate in /api/airdrop (PR #1587).
 */

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface GateResult {
  allowed: boolean;
  nextClaimAt: string | null;
  claimId?: number;
}

/**
 * Attempt to claim a faucet rate-limit slot.
 *
 * @param supabase  Service-role Supabase client
 * @param wallet    Wallet address
 * @param fundType  "sol" | "usdc" | "auto-fund"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tryFaucetGate(supabase: any, wallet: string, fundType: string): Promise<GateResult> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_MS).toISOString();

  try {
    // Step 1: Clear expired claim so unique slot is free for re-claim.
    await supabase
      .from("faucet_claims")
      .delete()
      .eq("wallet", wallet)
      .eq("fund_type", fundType)
      .lt("claimed_at", windowStart);

    // Step 2: INSERT-as-gate — race winner records the claim; all others hit 23505.
    const { data, error } = await supabase
      .from("faucet_claims")
      .insert({ wallet, fund_type: fundType, claimed_at: new Date().toISOString() })
      .select("id, claimed_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        // Active claim within window — compute nextClaimAt from existing row.
        const { data: existing } = await supabase
          .from("faucet_claims")
          .select("claimed_at")
          .eq("wallet", wallet)
          .eq("fund_type", fundType)
          .maybeSingle();

        const nextClaimAt = existing
          ? new Date(new Date(existing.claimed_at as string).getTime() + RATE_LIMIT_MS).toISOString()
          : null;
        return { allowed: false, nextClaimAt };
      }

      // Unexpected DB error — fail open (devnet-only, don't block users)
      console.warn(`[faucet-gate] INSERT error (code=${error.code}): ${error.message}`);
      return { allowed: true, nextClaimAt: null };
    }

    return { allowed: true, nextClaimAt: null, claimId: (data as { id: number } | null)?.id };
  } catch (err) {
    console.warn("[faucet-gate] threw:", err instanceof Error ? err.message : String(err));
    return { allowed: true, nextClaimAt: null };
  }
}

/**
 * Release a faucet claim slot (on mint failure so user isn't locked out).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function releaseFaucetClaim(supabase: any, claimId: number): Promise<void> {
  const { error } = await supabase.from("faucet_claims").delete().eq("id", claimId);
  if (error) {
    console.warn(`[faucet-gate] release failed (id=${claimId}): ${error.message}`);
  }
}
