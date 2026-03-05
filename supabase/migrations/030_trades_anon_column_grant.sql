-- Migration 030: Restrict trades SELECT to safe columns for anon role
-- Security: PR #678 (leaderboard — anon client + ISR)
--
-- Problem: trades table has a blanket USING(true) SELECT policy for anon
-- (migration 021 trades_select_anon). PR #678 switches /api/leaderboard
-- from service_role client to anon client. The anon role must only access
-- the 3 columns the leaderboard actually queries: trader, size, created_at.
-- Other columns (price, fee, tx_signature, slab_address, side) should not
-- be readable by unauthenticated users.
--
-- Fix: Revoke blanket SELECT, then grant only the leaderboard columns.
-- RLS row-level policy (trades_select_anon) stays in place.
-- Service role retains full access.

-- Revoke blanket SELECT from anon
REVOKE SELECT ON trades FROM anon;

-- Grant only the columns needed by the leaderboard
GRANT SELECT (
  trader,
  size,
  created_at
) ON trades TO anon;

-- Ensure service_role retains full access
GRANT ALL ON trades TO service_role;
