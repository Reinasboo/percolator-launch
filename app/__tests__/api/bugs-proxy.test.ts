/**
 * Tests for /api/bugs proxy route.
 *
 * GET  /api/bugs — auth-gated proxy (x-api-key required)
 * POST /api/bugs — public proxy (IP forwarding for per-IP rate limiting)
 *
 * Business logic (rate limiting, sanitisation, DB writes) lives in
 * percolator-api. These tests verify the proxy wrapper behaves correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Mock api-proxy so no real network calls are made
vi.mock("@/lib/api-proxy", () => ({
  proxyToApi: vi.fn(),
}));

// Mock api-auth to control auth check results
vi.mock("@/lib/api-auth", () => ({
  requireAuth: vi.fn(),
  UNAUTHORIZED: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

import { proxyToApi } from "@/lib/api-proxy";
import { requireAuth } from "@/lib/api-auth";
import { GET, POST } from "../../app/api/bugs/route";

function makeGetReq(apiKey?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  return new NextRequest("http://localhost/api/bugs", { headers });
}

function makePostReq(body: object, ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/bugs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("GET /api/bugs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth check fails (no proxy call)", async () => {
    vi.mocked(requireAuth).mockReturnValue(false);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(401);
    expect(vi.mocked(proxyToApi)).not.toHaveBeenCalled();
  });

  it("proxies to /bugs when auth passes, forwarding x-api-key", async () => {
    vi.mocked(requireAuth).mockReturnValue(true);
    const mockBugs = [{ id: 1, title: "test bug", severity: "medium" }];
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json(mockBugs, { status: 200 })
    );

    const res = await GET(makeGetReq("my-api-key"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledOnce();
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledWith(
      expect.any(Object), // req
      "/bugs",
      { "x-api-key": "my-api-key" }
    );
  });

  it("forwards empty x-api-key when header is absent", async () => {
    vi.mocked(requireAuth).mockReturnValue(true);
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json([], { status: 200 })
    );

    await GET(makeGetReq()); // no key in headers
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledWith(
      expect.any(Object),
      "/bugs",
      { "x-api-key": "" }
    );
  });

  it("forwards 502 when backend is unreachable", async () => {
    vi.mocked(requireAuth).mockReturnValue(true);
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
    );

    const res = await GET(makeGetReq("key"));
    expect(res.status).toBe(502);
  });
});

describe("POST /api/bugs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proxies to /bugs with body and x-real-ip from x-forwarded-for", async () => {
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json({ ok: true }, { status: 201 })
    );

    const req = makePostReq(
      { twitter_handle: "alice", title: "bug", description: "details", severity: "low" },
      "203.0.113.1"
    );
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledOnce();
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledWith(
      expect.any(Object),
      "/bugs",
      { "x-real-ip": "203.0.113.1" },
      { includeBody: true }
    );
  });

  it("uses x-real-ip header directly when x-forwarded-for is absent", async () => {
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json({ ok: true }, { status: 201 })
    );

    const req = new NextRequest("http://localhost/api/bugs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": "198.51.100.5",
      },
      body: JSON.stringify({ twitter_handle: "bob", title: "b", description: "d", severity: "high" }),
    });

    await POST(req);
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledWith(
      expect.any(Object),
      "/bugs",
      { "x-real-ip": "198.51.100.5" },
      { includeBody: true }
    );
  });

  it("uses 'unknown' as IP when neither forwarding header is present", async () => {
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json({ ok: true }, { status: 201 })
    );

    const req = new NextRequest("http://localhost/api/bugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: "t", title: "t", description: "d", severity: "low" }),
    });

    await POST(req);
    expect(vi.mocked(proxyToApi)).toHaveBeenCalledWith(
      expect.any(Object),
      "/bugs",
      { "x-real-ip": "unknown" },
      { includeBody: true }
    );
  });

  it("forwards 429 from backend when IP is rate-limited", async () => {
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json(
        { error: "Rate limited — max 3 bug reports per hour" },
        { status: 429 }
      )
    );

    const req = makePostReq({ twitter_handle: "t", title: "t", description: "d", severity: "low" });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("forwards 400 validation errors from backend", async () => {
    vi.mocked(proxyToApi).mockResolvedValue(
      NextResponse.json({ error: "Title required (max 120 chars)" }, { status: 400 })
    );

    const req = makePostReq({ twitter_handle: "t" }); // missing required fields
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
