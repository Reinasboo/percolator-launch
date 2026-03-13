/**
 * Tests for /api/chart/[mint] input validation + proxy behaviour.
 *
 * Since the route was converted to a thin proxy (GH feat/proxy-bugs-chart-to-api),
 * business logic (GeckoTerminal fetch, caching) lives in percolator-api.
 * These tests verify:
 *   1. The mint path segment is validated as a properly-decodable Solana PublicKey
 *      before the request is forwarded upstream (covers regression for GH issue #942).
 *   2. Valid mints are proxied and the upstream response is forwarded correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Mock the shared proxy utility — no real network calls in unit tests
vi.mock("@/lib/api-proxy", () => ({
  proxyToApi: vi.fn(),
}));

import { proxyToApi } from "@/lib/api-proxy";
import { GET } from "../../app/api/chart/[mint]/route";

function makeReq(mint: string): NextRequest {
  return new NextRequest(`http://localhost/api/chart/${mint}`);
}

async function callRoute(mint: string) {
  const req = makeReq(mint);
  const params = Promise.resolve({ mint });
  return GET(req, { params });
}

describe("GET /api/chart/[mint] — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an empty mint (no proxy call)", async () => {
    const res = await callRoute("");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid mint/i);
    expect(vi.mocked(proxyToApi)).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-base58 string (no proxy call)", async () => {
    const res = await callRoute("not-a-pubkey!!");
    expect(res.status).toBe(400);
    expect(vi.mocked(proxyToApi)).not.toHaveBeenCalled();
  });

  it("returns 400 for a base58-alphabet string that is not a valid pubkey (no proxy call)", async () => {
    const res = await callRoute("1111111111111111111111111111111"); // 31 chars — too short
    expect(res.status).toBe(400);
    expect(vi.mocked(proxyToApi)).not.toHaveBeenCalled();
  });

  it("accepts a valid Solana pubkey and proxies to percolator-api", async () => {
    const mockPayload = { candles: [], poolAddress: null, cached: false };
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json(mockPayload, { status: 200 })
    );

    const res = await callRoute("11111111111111111111111111111111"); // system program
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("candles");
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledOnce();
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledWith(
      expect.any(Object), // req
      "/chart/11111111111111111111111111111111"
    );
  });

  it("forwards OHLCV candles from upstream when a pool exists", async () => {
    const candles = [
      { timestamp: 1_700_000_000_000, open: 1.0, high: 1.1, low: 0.9, close: 1.05, volume: 500 },
    ];
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json(
        { candles, poolAddress: "somePool123", cached: false },
        { status: 200 }
      )
    );

    const res = await callRoute("So11111111111111111111111111111111111111112"); // wSOL
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candles).toHaveLength(1);
    expect(body.poolAddress).toBe("somePool123");
  });
});
