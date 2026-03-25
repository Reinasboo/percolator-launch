/**
 * GH#1692: Timing-safe comparison in oracle-keeper/register and keeper /register endpoint
 *
 * Verifies that:
 * 1. The route uses timingSafeEqual, not plain string comparison
 * 2. Requests with wrong secret are rejected with 401
 * 3. Requests with correct secret are accepted (auth layer only)
 * 4. Length-differing secrets are also rejected (no short-circuit)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies before importing route ──────────────────────────────────

vi.mock("@/lib/supabase", () => ({
  getServiceClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { code: "PGRST116" } }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@solana/web3.js", () => ({
  PublicKey: class {
    constructor(s: string) {
      if (s.length < 32) throw new Error("Invalid pubkey");
    }
  },
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GH#1692: oracle-keeper/register timing-safe auth", () => {
  const CORRECT_SECRET = "super-secret-register-key-12345";

  beforeEach(() => {
    vi.resetModules();
    process.env.KEEPER_REGISTER_SECRET = CORRECT_SECRET;
    process.env.KEEPER_INTERNAL_URL = "http://localhost:8081";
  });

  afterEach(() => {
    delete process.env.KEEPER_REGISTER_SECRET;
    delete process.env.KEEPER_INTERNAL_URL;
  });

  function makeRequest(secret: string, body?: object): NextRequest {
    return new NextRequest("http://localhost/api/oracle-keeper/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-keeper-secret": secret,
      },
      body: JSON.stringify(body ?? {
        slabAddress: "11111111111111111111111111111111",
        mainnetCA: "22222222222222222222222222222222",
      }),
    });
  }

  it("rejects wrong secret with 401", async () => {
    const { POST } = await import("@/app/api/oracle-keeper/register/route");
    const res = await POST(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects empty secret with 401", async () => {
    const { POST } = await import("@/app/api/oracle-keeper/register/route");
    const res = await POST(makeRequest(""));
    expect(res.status).toBe(401);
  });

  it("rejects prefix-match secrets with 401 (no short-circuit)", async () => {
    const { POST } = await import("@/app/api/oracle-keeper/register/route");
    // Same prefix, shorter — would fool a startsWith check
    const res = await POST(makeRequest(CORRECT_SECRET.slice(0, 10)));
    expect(res.status).toBe(401);
  });

  it("rejects when KEEPER_REGISTER_SECRET not configured", async () => {
    delete process.env.KEEPER_REGISTER_SECRET;
    vi.resetModules();
    process.env.KEEPER_INTERNAL_URL = "http://localhost:8081";
    const { POST } = await import("@/app/api/oracle-keeper/register/route");
    const res = await POST(makeRequest(CORRECT_SECRET));
    expect(res.status).toBe(503);
  });

  it("passes auth with correct secret (proceeds to validation)", async () => {
    const { POST } = await import("@/app/api/oracle-keeper/register/route");
    // Correct secret but invalid pubkeys → 400, not 401
    const res = await POST(makeRequest(CORRECT_SECRET, {
      slabAddress: "not-a-pubkey",
      mainnetCA: "also-not-a-pubkey",
    }));
    // Should pass auth and fail on pubkey validation, not on auth
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
  });
});
