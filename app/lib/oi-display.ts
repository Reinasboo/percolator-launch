/**
 * Shared helper for deriving the displayable OI USD value from a market row.
 *
 * GH#1599: Zero OI is always valid (means "no open positions") — the phantom
 * guard should only suppress *positive* OI on un-backed markets, not zeros.
 * GH#1610: admin-oracle markets with real vault + OI atoms but no oracle price
 * (keeper never cranked) return null from rawToUsd. Display as 0 not null so
 * sort=oi ranks these consistently instead of placing them after zero-OI markets.
 */

/**
 * Returns the total_open_interest_usd value to expose in API responses.
 *
 * @param totalOpenInterestUsd - Computed OI in USD (may be 0 or null)
 * @param isPhantom             - Whether isPhantomOpenInterest() returned true
 * @param rawOiAtoms            - Raw OI atom value before USD conversion (optional).
 *                                GH#1610: used to distinguish "atoms > 0 but no price"
 *                                (→ 0) from "genuinely no OI data" (→ null).
 * @returns 0 when phantom (atoms are zeroed, USD must match),
 *          0 when OI is zero (valid regardless of phantom status),
 *          0 when atoms > 0 but price unavailable (GH#1610: admin-oracle, unpriced),
 *          null when no OI atoms and no USD value,
 *          otherwise the raw OI USD value.
 */
export function computeDisplayOiUsd(
  totalOpenInterestUsd: number | null,
  isPhantom: boolean,
  rawOiAtoms?: number | null,
): number | null {
  // GH#1606: phantom markets have all OI atom fields zeroed in the response
  // (total_open_interest, open_interest_long, open_interest_short → 0).
  // The USD field must be consistent with zeroed atoms: always 0.
  // Previously, stale positive OI converted to a positive USD value, then
  // returned null — producing { total_open_interest: 0, total_open_interest_usd: null }.
  if (isPhantom) return 0;
  // GH#1599: zero OI is always valid regardless of vault/phantom status
  if (totalOpenInterestUsd === 0) return 0;
  if (totalOpenInterestUsd === null) {
    // GH#1610: atoms > 0 but oracle price unavailable (admin-oracle, keeper never cranked).
    // rawToUsd returns null when price is null/zero. Rather than propagating null (which
    // breaks sort=oi — null ranks after zero-OI markets), return 0 to signal "OI exists
    // but cannot be priced". Atoms field is still correctly populated in the response.
    if (rawOiAtoms != null && rawOiAtoms > 0) return 0;
    return null;
  }
  return totalOpenInterestUsd;
}
