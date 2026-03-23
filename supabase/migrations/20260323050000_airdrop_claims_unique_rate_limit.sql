-- Migration: GH#1588 — Enforce airdrop_claims unique constraint + add market_address column
--
-- Context: The /api/airdrop route (PERC-363) records claims in airdrop_claims but the
-- table was created manually without a UNIQUE INDEX. Combined with the old SELECT→INSERT
-- two-step, this creates a TOCTOU race: two rapid requests for the same wallet+market
-- both pass the rate-limit SELECT, then both INSERT, bypassing the 24h cap.
--
-- This migration:
--   1. Ensures the table + market_address column exist (idempotent)
--   2. Adds a UNIQUE INDEX on (wallet, market_address) — the atomic gate
--   3. Removes duplicate active rows (keeping the earliest per wallet+market)
--   4. Reloads PostgREST schema cache
--
-- After this migration: /api/airdrop uses INSERT-as-gate (conflict on unique index)
-- instead of SELECT→INSERT, eliminating the TOCTOU race.

-- 1. Create table if it doesn't exist (in case someone wiped it)
CREATE TABLE IF NOT EXISTS airdrop_claims (
  id          BIGSERIAL     PRIMARY KEY,
  wallet      TEXT          NOT NULL,
  market_address TEXT       NOT NULL,
  amount_tokens FLOAT,
  amount_usd  FLOAT,
  signature   TEXT,
  claimed_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. Ensure market_address column exists (it may have been absent from old manual schema)
ALTER TABLE airdrop_claims
  ADD COLUMN IF NOT EXISTS market_address TEXT NOT NULL DEFAULT '';

-- 3. Remove duplicate active rows — keep only the earliest claim per wallet+market
-- (avoids unique-index creation failure on existing duplicate data)
DELETE FROM airdrop_claims a
WHERE a.id NOT IN (
  SELECT MIN(id)
  FROM airdrop_claims
  GROUP BY wallet, market_address
);

-- 4. Add unique index (one active slot per wallet+market)
--    This is the INSERT-as-gate anchor — duplicate INSERTs get error code 23505.
CREATE UNIQUE INDEX IF NOT EXISTS airdrop_claims_wallet_market_idx
  ON airdrop_claims(wallet, market_address);

-- 5. Speed up 24h window lookup
CREATE INDEX IF NOT EXISTS airdrop_claims_claimed_at_idx
  ON airdrop_claims(claimed_at);

-- 6. RLS (service_role bypasses; no public access needed)
ALTER TABLE airdrop_claims ENABLE ROW LEVEL SECURITY;

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
