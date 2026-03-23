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
 * @returns 0 when OI is zero (valid regardless of phantom status),
 *          null when OI is positive but market is phantom (suppress stale OI),
 *          otherwise the raw OI USD value.
 */
export function computeDisplayOiUsd(
  totalOpenInterestUsd: number | null,
  isPhantom: boolean,
): number | null {
  // GH#1599: zero OI is always valid regardless of vault/phantom status
  return totalOpenInterestUsd === 0 ? 0 : isPhantom ? null : totalOpenInterestUsd;
}
