import { Hono } from "hono";
import { PublicKey } from "@solana/web3.js";
import * as Sentry from "@sentry/node";
import { validateSlab } from "../middleware/validateSlab.js";
import { cacheMiddleware } from "../middleware/cache.js";
import { withDbCacheFallback } from "../middleware/db-cache-fallback.js";
import { fetchSlab, parseHeader, parseConfig, parseEngine } from "@percolator/sdk";
import { getConnection, getSupabase, createLogger, sanitizeSlabAddress } from "@percolator/shared";

const logger = createLogger("api:markets");

/**
 * Maximum sane price in USD (float) stored in the DB.
 * Prices are stored as USD floats (e.g. 42500 = $42,500).
 * Cap at $1M — well above any real crypto today but well below
 * unscaled admin-set garbage values (e.g. 900,000,000 = $900M). (#882, #856)
 * If price units ever change (e.g. micro-USD, or BTC > $1M) this constant
 * must be revisited — do NOT silently change it without a comment update.
 */
const MAX_SANE_PRICE_USD = 1_000_000;

/**
 * Sanitize a price field from the DB view.
 * Returns the value when valid; null when out-of-range or non-finite.
 * Emits a Sentry warning when a non-null value is rejected so that any
 * corruption reaching the API surface is observable. (#882)
 */
function sanitizeMarketPrice(
  value: number | null | undefined,
  field: string,
  slabAddress: string,
): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SANE_PRICE_USD) {
    Sentry.captureMessage(
      `[markets] Corrupt ${field} sanitized to null — slab: ${slabAddress}, value: ${value}`,
      { level: "warning", tags: { field, slab: slabAddress } },
    );
    logger.warn(`Corrupt ${field} sanitized to null`, { slab: slabAddress, value });
    return null;
  }
  return value;
}

// Markets to exclude from public API responses.
// Populated from BLOCKED_MARKET_ADDRESSES env var (comma-separated slab addresses).
// Use this to hide markets with wrong oracle_authority or corrupt state (e.g. issue #837).
const BLOCKED_MARKET_ADDRESSES: ReadonlySet<string> = new Set(
  (process.env.BLOCKED_MARKET_ADDRESSES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function marketRoutes(): Hono {
  const app = new Hono();

  // GET /markets — list all markets from Supabase (uses markets_with_stats view for performance)
  app.get("/markets", async (c) => {
    const result = await withDbCacheFallback(
      "markets:all",
      async () => {
        // Use the markets_with_stats view for a single optimized query
        const { data, error } = await getSupabase()
          .from("markets_with_stats")
          .select("*");

        if (error) throw error;

        return (data ?? [])
          .filter((m) => !BLOCKED_MARKET_ADDRESSES.has(m.slab_address))
          .map((m) => ({
          slabAddress: m.slab_address,
          mintAddress: m.mint_address,
          symbol: m.symbol,
          name: m.name,
          decimals: m.decimals,
          deployer: m.deployer,
          oracleAuthority: m.oracle_authority,
          initialPriceE6: m.initial_price_e6,
          maxLeverage: m.max_leverage,
          tradingFeeBps: m.trading_fee_bps,
          lpCollateral: m.lp_collateral,
          matcherContext: m.matcher_context,
          status: m.status,
          logoUrl: m.logo_url,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
          // Stats from the view
          totalOpenInterest: m.total_open_interest ?? null,
          totalAccounts: m.total_accounts ?? null,
          lastCrankSlot: m.last_crank_slot ?? null,
          lastPrice: sanitizeMarketPrice(m.last_price, "last_price", m.slab_address),
          markPrice: sanitizeMarketPrice(m.mark_price, "mark_price", m.slab_address),
          // #881/#882: Apply same guard to indexPrice — same DB column type and corruption vector.
          indexPrice: sanitizeMarketPrice(m.index_price, "index_price", m.slab_address),
          fundingRate: (m.funding_rate != null && Number.isFinite(m.funding_rate) && Math.abs(m.funding_rate) <= 10_000) ? m.funding_rate : null,
          netLpPos: m.net_lp_pos ?? null,
        }));
      },
      c
    );
    
    // If result is a Response (error case), return it directly
    if (result instanceof Response) {
      return result;
    }
    
    return c.json({ markets: result });
  });

  // GET /markets/stats — all market stats from DB
  app.get("/markets/stats", async (c) => {
    try {
      const { data, error } = await getSupabase().from("market_stats").select("*");
      if (error) throw error;
      return c.json({ stats: data ?? [] });
    } catch (err) {
      return c.json({ error: "Failed to fetch market stats" }, 500);
    }
  });

  // GET /markets/:slab/stats — single market stats from DB
  app.get("/markets/:slab/stats", validateSlab, async (c) => {
    const slab = c.req.param("slab");
    try {
      const { data, error } = await getSupabase()
        .from("market_stats")
        .select("*")
        .eq("slab_address", slab)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return c.json({ stats: data ?? null });
    } catch (err) {
      return c.json({ error: "Failed to fetch market stats" }, 500);
    }
  });

  // GET /markets/:slab — single market details (on-chain read) — 10s cache
  app.get("/markets/:slab", cacheMiddleware(10), validateSlab, async (c) => {
    const slab = c.req.param("slab");
    if (!slab) return c.json({ error: "slab required" }, 400);
    try {
      const connection = getConnection();
      const slabPubkey = new PublicKey(slab);
      const data = await fetchSlab(connection, slabPubkey);
      const header = parseHeader(data);
      const cfg = parseConfig(data);
      const engine = parseEngine(data);

      return c.json({
        slabAddress: slab,
        header: {
          magic: header.magic.toString(),
          version: header.version,
          admin: header.admin.toBase58(),
          resolved: header.resolved,
        },
        config: {
          collateralMint: cfg.collateralMint.toBase58(),
          vault: cfg.vaultPubkey.toBase58(),
          oracleAuthority: cfg.oracleAuthority.toBase58(),
          authorityPriceE6: cfg.authorityPriceE6.toString(),
        },
        engine: {
          vault: engine.vault.toString(),
          totalOpenInterest: engine.totalOpenInterest.toString(),
          numUsedAccounts: engine.numUsedAccounts,
          lastCrankSlot: engine.lastCrankSlot.toString(),
        },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      logger.error("Market fetch error", { detail, path: c.req.path });
      return c.json({ error: "Failed to fetch market data" }, 400);
    }
  });

  return app;
}
