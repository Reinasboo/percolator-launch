/**
 * GH#1599: Markets with zero OI AND zero vault should return
 * total_open_interest_usd: 0 (not null).
 *
 * The phantom OI guard (isPhantomOpenInterest) suppresses *positive* OI when
 * vault < MIN_VAULT_FOR_OI, but zero OI is always valid — it means "no positions".
 */
import { describe, it, expect } from "vitest";

// Inline the logic from route.ts to unit-test the displayOiUsd derivation
function computeDisplayOiUsd(
  totalOpenInterestUsd: number | null,
  isPhantom: boolean,
): number | null {
  // GH#1599 fix: zero OI is always valid regardless of phantom status
  return totalOpenInterestUsd === 0 ? 0 : (isPhantom ? null : totalOpenInterestUsd);
}

describe("GH#1599 — zero OI with zero vault", () => {
  it("returns 0 for zero-OI market with vault=0 (previously null)", () => {
    // isPhantom=true because vault=0, but OI USD is genuinely 0
    expect(computeDisplayOiUsd(0, true)).toBe(0);
  });

  it("returns 0 for zero-OI market with vault=1M (non-phantom)", () => {
    expect(computeDisplayOiUsd(0, false)).toBe(0);
  });

  it("returns null for positive OI on phantom market", () => {
    // Stale/orphaned OI on a market with no vault backing
    expect(computeDisplayOiUsd(1234.56, true)).toBeNull();
  });

  it("returns the value for positive OI on non-phantom market", () => {
    expect(computeDisplayOiUsd(1234.56, false)).toBe(1234.56);
  });

  it("returns null when OI USD is null (no price available)", () => {
    expect(computeDisplayOiUsd(null, false)).toBeNull();
    expect(computeDisplayOiUsd(null, true)).toBeNull();
  });
});
