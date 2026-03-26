-- Migration: Fix BTC/USD oracle decimal mismatch — GH#1730
--
-- Problem: Market GGU89iQLmceyXRDK8vgAxVvdi9RJb9JsPhXZ2NoFSENV (BTC/USD)
-- was registered in oracle_markets with oracle_type='hyperp' pointing at a
-- BTC/SOL PumpSwap pool. The on-chain UpdateHyperpMark computes:
--
--   price_e6 = quote_vault_lamports * 1_000_000 / base_vault_atoms
--
-- For a BTC/SOL pool this yields SOL-per-BTC (≈150 at current rates), NOT
-- USD-per-BTC (≈$68,000). There is no SOL→USD conversion in this path.
-- Result: 193 accounts see a mark price of ~$148 instead of ~$68,000 — a
-- 466× error that would cause immediate cascading liquidations if trading
-- were enabled.
--
-- Root cause: HYPERP oracle requires a USD-denominated quote token in the pool
-- (e.g., USDC, USDT). A SOL-quoted pool is not valid for HYPERP oracle mode.
--
-- Fix:
--   1. Disable the faulty oracle_markets HYPERP entry for this slab.
--      The keeper will fall back to admin-oracle mode (PushOraclePrice) with
--      DexScreener/Jupiter for the real USD price.
--   2. Upsert a devnet_mints row mapping the devnet BTC mint to the mainnet
--      wBTC CA. The oracle-keeper uses this as the price lookup key so
--      DexScreener returns the real ~$68,000 price.
--   3. Backfill markets.mainnet_ca for this slab so the keeper's per-market
--      mainnetCA field is populated on next discovery.
--
-- References: GH#1730, 2026-03-26

-- ── Step 1: Disable the faulty HYPERP oracle entry ──────────────────────────
UPDATE oracle_markets
SET
  enabled    = false,
  notes      = COALESCE(notes, '') || ' | DISABLED 2026-03-26 GH#1730: BTC/SOL pool gives SOL-denominated price, not USD. Use admin-oracle + DexScreener/Jupiter instead.',
  updated_at = NOW()
WHERE slab_address = 'GGU89iQLmceyXRDK8vgAxVvdi9RJb9JsPhXZ2NoFSENV'
  AND enabled = true;

-- ── Step 2: Map devnet BTC mint → mainnet wBTC CA ───────────────────────────
-- Devnet token: CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C (user-created BTC)
-- Mainnet wBTC: 9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E (Wrapped Bitcoin)
-- DexScreener for 9n4nbM75f... returns ~$68,000, correcting the price display.
INSERT INTO devnet_mints (devnet_mint, mainnet_ca, symbol, name)
VALUES (
  'CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C',
  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  'BTC',
  'Bitcoin'
)
ON CONFLICT (devnet_mint) DO UPDATE
  SET mainnet_ca = EXCLUDED.mainnet_ca,
      symbol     = EXCLUDED.symbol,
      name       = EXCLUDED.name,
      updated_at = NOW();

-- ── Step 3: Backfill markets.mainnet_ca for BTC slabs with this devnet mint ─
-- Covers GGU89iQLmceyXRDK8vgAxVvdi9RJb9JsPhXZ2NoFSENV and AB3ZN1vxbBEh...
-- (both use CJUyV594 as collateral mint per migration 042).
UPDATE markets
SET
  mainnet_ca = '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  updated_at = NOW()
WHERE mint_address = 'CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C'
  AND (mainnet_ca IS NULL OR mainnet_ca != '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E');

-- Verify (informational):
-- SELECT slab_address, oracle_type, enabled FROM oracle_markets
-- WHERE slab_address = 'GGU89iQLmceyXRDK8vgAxVvdi9RJb9JsPhXZ2NoFSENV';
-- → should return enabled=false
--
-- SELECT devnet_mint, mainnet_ca, symbol FROM devnet_mints
-- WHERE devnet_mint = 'CJUyV594JzJpK2BUakNpm6NbmCkhQoPJWkKjfKTvxJ3C';
-- → should return mainnet_ca=9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E
