import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUpsert = vi.fn();

async function loadPostHandler() {
  vi.resetModules();

  vi.doMock("@/lib/supabase", () => ({
    getServiceClient: () => ({
      from: () => ({
        upsert: mockUpsert,
      }),
    }),
  }));

  vi.doMock("@/lib/get-client-ip", () => ({
    getClientIp: () => "1.2.3.4",
  }));

  const mod = await import("@/app/api/devnet-register-mint/route");
  return mod.POST as (req: NextRequest) => Promise<Response>;
}

describe("POST /api/devnet-register-mint abuse guards", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("rejects invalid JSON body", async () => {
    const POST = await loadPostHandler();
    const req = new NextRequest("http://localhost/api/devnet-register-mint", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid JSON body/i);
  });

  it("rejects invalid symbol format", async () => {
    const POST = await loadPostHandler();
    const req = new NextRequest("http://localhost/api/devnet-register-mint", {
      method: "POST",
      body: JSON.stringify({
        mintAddress: "So11111111111111111111111111111111111111112",
        symbol: "bad symbol!",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects out-of-range decimals", async () => {
    const POST = await loadPostHandler();
    const req = new NextRequest("http://localhost/api/devnet-register-mint", {
      method: "POST",
      body: JSON.stringify({
        mintAddress: "So11111111111111111111111111111111111111112",
        decimals: 99,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rate limits repeated requests from same IP", async () => {
    const POST = await loadPostHandler();

    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const req = new NextRequest("http://localhost/api/devnet-register-mint", {
        method: "POST",
        body: JSON.stringify({
          mintAddress: "So11111111111111111111111111111111111111112",
        }),
        headers: { "content-type": "application/json" },
      });
      const res = await POST(req);
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
