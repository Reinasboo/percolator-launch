-- Drop stale permissive INSERT/UPDATE policies on core financial tables.
--
-- PROBLEM:
--   schema.sql (the reference file sometimes run via Supabase SQL Editor) created
--   INSERT/UPDATE policies on markets, market_stats, trades, and oracle_prices
--   with NO `TO` clause — defaulting to the PUBLIC pseudo-role (all roles including anon).
--   Policy names: "Service can insert markets", "Service can update markets", etc.
--
--   Migration 021 attempted to fix this by dropping and recreating as service_role-only,
--   but used wrong policy names ("markets_insert", "markets_update") that never existed.
--   The DROP POLICY IF EXISTS calls were silent no-ops.
--
--   If schema.sql was ever run against the database, the old permissive policies still
--   coexist with the service_role-only policies from 021. PostgreSQL OR's permissive
--   policies — if ANY policy grants access, access is granted. An attacker with the
--   public anon key could INSERT fake markets/trades or UPDATE market_stats/oracle_prices.
--
-- FIX:
--   Drop every known stale policy name from both schema.sql and migration 001.
--   Uses DROP IF EXISTS so this is safe even if the policies don't exist.
--   The service_role-only policies from migration 021 remain as the sole write policies.

-- markets
DROP POLICY IF EXISTS "Service can insert markets" ON markets;
DROP POLICY IF EXISTS "Service can update markets" ON markets;

-- market_stats
DROP POLICY IF EXISTS "Service can insert stats" ON market_stats;
DROP POLICY IF EXISTS "Service can update stats" ON market_stats;

-- trades
DROP POLICY IF EXISTS "Service can insert trades" ON trades;

-- oracle_prices
DROP POLICY IF EXISTS "Service can insert prices" ON oracle_prices;

-- Also drop the wrong-name policies that migration 021 tried to drop
-- (in case some other path created them under those names)
DROP POLICY IF EXISTS "markets_insert" ON markets;
DROP POLICY IF EXISTS "markets_update" ON markets;
DROP POLICY IF EXISTS "market_stats_insert" ON market_stats;
DROP POLICY IF EXISTS "market_stats_update" ON market_stats;
DROP POLICY IF EXISTS "trades_insert" ON trades;
DROP POLICY IF EXISTS "oracle_prices_insert" ON oracle_prices;
DROP POLICY IF EXISTS "oracle_prices_update" ON oracle_prices;
