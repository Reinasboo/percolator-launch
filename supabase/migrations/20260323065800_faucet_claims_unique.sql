-- GH#1595: TOCTOU fix for faucet/auto-fund rate limiting
-- Creates a gate table with unique constraint on (wallet, fund_type)
-- so concurrent requests race on INSERT (23505), not SELECT→INSERT.

CREATE TABLE IF NOT EXISTS faucet_claims (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  fund_type TEXT NOT NULL,  -- 'sol', 'usdc', or 'auto-fund'
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The gate: only one active claim per wallet+type at a time.
-- DELETE expired rows before INSERT; race loser gets 23505.
CREATE UNIQUE INDEX uq_faucet_claims_wallet_type
  ON faucet_claims(wallet, fund_type);

-- RLS: service role only
ALTER TABLE faucet_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faucet_claims_service_all"
  ON faucet_claims FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE faucet_claims IS 'Rate-limit gate for devnet faucet + auto-fund. UNIQUE on (wallet, fund_type) prevents TOCTOU races.';
