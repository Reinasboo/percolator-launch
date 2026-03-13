/**
 * GET /api/chart/[mint]?timeframe=1h&limit=168
 *
 * Proxy to percolator-api GET /chart/:mint.
 *
 * Mint validation is kept here so Vercel can reject malformed requests at the
 * edge before they hit Railway.
 *
 * Business logic (GeckoTerminal fetch, in-memory cache, candle parsing) now
 * lives in percolator-api and is tested there.
 *
 * Response: { candles: CandleData[], poolAddress: string | null, cached: boolean }
 */

import { type NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

// Re-export the CandleData type so consumers can import it from the route module
// without importing from percolator-api directly.
export interface CandleData {
  timestamp: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  // Validate mint at the edge before forwarding to Railway.
  // PublicKey constructor ensures the bytes decode to a valid 32-byte point,
  // not just a base58-alphabet string. Matches the upstream validation.
  try {
    if (!mint) throw new Error("missing");
    new PublicKey(mint);
  } catch {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  // Proxy to percolator-api, forwarding timeframe/aggregate/limit query params.
  // Cache-Control is passed through from the upstream (60s public cache).
  return proxyToApi(req, `/chart/${mint}`);
}
