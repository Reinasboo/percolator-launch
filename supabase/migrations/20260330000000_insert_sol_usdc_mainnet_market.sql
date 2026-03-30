-- Migration 20260330000000: Insert SOL/USDC mainnet market row (PERC-8227)
--
-- Context: The first mainnet market (SOL/USDC PERP) was created on-chain on 2026-03-29
-- at ~23:29 UTC. The slab exists at address 8NY7rvQJXNTinJkAQG1GUV8NQ1hQzdtF7iWNjK9p7tQN,
-- owned by program ESa89R5Es3rJ5mnwGybVRG1GrNt9etP11Z5V2QWD4edv. However, the mainnet
-- Supabase database has no row for it, so /api/markets returns 0 mainnet markets and the
-- frontend cannot see it.
--
-- On-chain data (verified 2026-03-30):
--   - Slab: 8NY7rvQJXNTinJkAQG1GUV8NQ1hQzdtF7iWNjK9p7tQN
--   - Program: ESa89R5Es3rJ5mnwGybVRG1GrNt9etP11Z5V2QWD4edv
--   - Admin (deployer): 7JVQvrAfzj3aasLxCkoLYX5KQcrb5nEZhUe5Qa8PvV5G
--   - Collateral: USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
--   - Oracle mode: HYPERP (oracle_authority = 11obSVaVR4k4UUTqwApP5FZeFW5qKkMRVNHKbHr7QZ5)
--   - IndexFeedId: 3kBNhfPcjtL5j4B36bGjcDg3wwukKTr3QZjMzbM4raMG
--   - Phase 1: max_leverage=2x, trading_fee=30bps ($10K OI cap, 72h warmup)
--   - Underlying: SOL (mainnet_ca = So11111111111111111111111111111111111111112)
--
-- NOTE: This migration targets the MAINNET Supabase project (ygvbajglkrwkbjdjyhxi).
-- Run ONLY on mainnet — do NOT apply to the devnet project.
-- Pre-requisite: Migrations 001-052 + 20260329180000_add_network_column.sql must
-- already be applied (20260329180000 adds the `network` column to markets table).
--
-- After inserting the markets row, we also insert an oracle_markets row so the
-- oracle-keeper will discover and start cranking UpdateHyperpMark for this market.
-- The dex_pool_address for the oracle_markets row is the Raydium CLMM SOL/USDC pool
-- that the HYPERP keeper reads on-chain to compute the mark price.

-- ============================================================================
-- 1. Insert SOL/USDC PERP into markets table
-- ============================================================================

INSERT INTO markets (
  slab_address,
  mint_address,
  symbol,
  name,
  decimals,
  deployer,
  oracle_authority,
  max_leverage,
  trading_fee_bps,
  oracle_mode,
  dex_pool_address,
  mainnet_ca,
  network
) VALUES (
  '8NY7rvQJXNTinJkAQG1GUV8NQ1hQzdtF7iWNjK9p7tQN',  -- slab address
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',   -- collateral mint (USDC)
  'SOL',                                              -- symbol
  'SOL/USDC Perpetual',                              -- name
  6,                                                  -- USDC decimals
  '7JVQvrAfzj3aasLxCkoLYX5KQcrb5nEZhUe5Qa8PvV5G',   -- deployer (deploy authority)
  '11obSVaVR4k4UUTqwApP5FZeFW5qKkMRVNHKbHr7QZ5',   -- oracle_authority (HYPERP keeper)
  2,                                                  -- max_leverage (2x — Phase 1)
  30,                                                 -- trading_fee_bps (0.30%)
  'hyperp',                                           -- oracle_mode
  '3kBNhfPcjtL5j4B36bGjcDg3wwukKTr3QZjMzbM4raMG',   -- dex_pool_address (from on-chain IndexFeedId)
  'So11111111111111111111111111111111111111112',      -- mainnet_ca (wrapped SOL / SOL mint)
  'mainnet'                                           -- network = mainnet
)
ON CONFLICT (slab_address) DO UPDATE SET
  network          = EXCLUDED.network,
  oracle_mode      = EXCLUDED.oracle_mode,
  oracle_authority = EXCLUDED.oracle_authority,
  max_leverage     = EXCLUDED.max_leverage,
  trading_fee_bps  = EXCLUDED.trading_fee_bps,
  mainnet_ca       = EXCLUDED.mainnet_ca,
  dex_pool_address = EXCLUDED.dex_pool_address,
  symbol           = EXCLUDED.symbol,
  name             = EXCLUDED.name;

-- ============================================================================
-- 2. Create initial market_stats row (so markets_with_stats view returns data)
-- ============================================================================

INSERT INTO market_stats (slab_address)
VALUES ('8NY7rvQJXNTinJkAQG1GUV8NQ1hQzdtF7iWNjK9p7tQN')
ON CONFLICT (slab_address) DO NOTHING;

-- ============================================================================
-- 3. Register oracle_markets entry for HYPERP keeper discovery
--    oracle-keeper reads this table (every 30s) and starts cranking UpdateHyperpMark
-- ============================================================================

INSERT INTO oracle_markets (
  slab_address,
  oracle_type,
  dex_pool_address,
  enabled,
  notes
) VALUES (
  '8NY7rvQJXNTinJkAQG1GUV8NQ1hQzdtF7iWNjK9p7tQN',
  'hyperp',
  '3kBNhfPcjtL5j4B36bGjcDg3wwukKTr3QZjMzbM4raMG',  -- on-chain IndexFeedId (SOL/USDC pool or feed)
  true,
  'SOL/USDC PERP mainnet — first mainnet market, created 2026-03-29. PERC-8227.'
)
ON CONFLICT (slab_address) DO UPDATE SET
  oracle_type      = EXCLUDED.oracle_type,
  dex_pool_address = EXCLUDED.dex_pool_address,
  enabled          = true,
  notes            = EXCLUDED.notes,
  updated_at       = NOW();

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'PERC-8227: SOL/USDC mainnet market inserted.';
  RAISE NOTICE 'Slab: 8NY7rvQJXNTinJkAQG1GUV8NQ1hQzdtF7iWNjK9p7tQN';
  RAISE NOTICE 'Verify with: SELECT slab_address, symbol, network, oracle_mode FROM markets WHERE slab_address = ''8NY7rvQJXNTinJkAQG1GUV8NQ1hQzdtF7iWNjK9p7tQN'';';
  RAISE NOTICE 'After indexer starts (PERC-8193): market stats will populate and frontend will show it.';
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
