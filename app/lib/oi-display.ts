/**
 * Shared helper for deriving the displayable OI USD value from a market row.
 *
 * GH#1599: Zero OI is always valid (means "no open positions") — the phantom
 * guard should only suppress *positive* OI on un-backed markets, not zeros.
 */

/**
 * Returns the total_open_interest_usd value to expose in API responses.
 *
 * @param totalOpenInterestUsd - Computed OI in USD (may be 0 or null)
 * @param isPhantom             - Whether isPhantomOpenInterest() returned true
 * @returns 0 when phantom (atoms are zeroed, USD must match),
 *          0 when OI is zero (valid regardless of phantom status),
 *          null when no price available,
 *          otherwise the raw OI USD value.
 */
export function computeDisplayOiUsd(
  totalOpenInterestUsd: number | null,
  isPhantom: boolean,
): number | null {
  // GH#1606: phantom markets have all OI atom fields zeroed in the response
  // (total_open_interest, open_interest_long, open_interest_short → 0).
  // The USD field must be consistent with zeroed atoms: always 0.
  // Previously, stale positive OI converted to a positive USD value, then
  // returned null — producing { total_open_interest: 0, total_open_interest_usd: null }.
  if (isPhantom) return 0;
  // GH#1599: zero OI is always valid regardless of vault/phantom status
  if (totalOpenInterestUsd === 0) return 0;
  // No price available → no USD value computable
  if (totalOpenInterestUsd === null) return null;
  return totalOpenInterestUsd;
}
