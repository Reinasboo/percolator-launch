/**
 * PERC-532: Tests for ResilientRpc exponential backoff + endpoint rotation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @solana/web3.js before importing rpc module
vi.mock("@solana/web3.js", () => {
  const Connection = vi.fn().mockImplementation((url: string) => ({
    _rpcEndpoint: url,
  }));
  const sendAndConfirmTransaction = vi.fn();
  return { Connection, sendAndConfirmTransaction };
});

// Mock logger
vi.mock("../src/logger.js", () => ({
  log: vi.fn(),
  logError: vi.fn(),
}));

import { ResilientRpc, parseRpcEndpoints } from "../src/rpc.js";

describe("parseRpcEndpoints", () => {
  it("returns single endpoint when no RPC_URLS set", () => {
    delete process.env.RPC_URLS;
    expect(parseRpcEndpoints("https://primary.rpc")).toEqual(["https://primary.rpc"]);
  });

  it("prepends primary and deduplicates", () => {
    process.env.RPC_URLS = "https://fallback1.rpc, https://fallback2.rpc, https://primary.rpc";
    const result = parseRpcEndpoints("https://primary.rpc");
    expect(result).toEqual([
      "https://primary.rpc",
      "https://fallback1.rpc",
      "https://fallback2.rpc",
    ]);
    delete process.env.RPC_URLS;
  });
});

describe("ResilientRpc", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("succeeds on first try without retrying", async () => {
    const rpc = new ResilientRpc(["https://ep1.rpc"]);
    const result = await rpc.withRetry(async () => "ok", "test");
    expect(result).toBe("ok");
    expect(rpc.stats.totalRetries).toBe(0);
  });

  it("retries on 429 and eventually succeeds", async () => {
    const rpc = new ResilientRpc(["https://ep1.rpc"], "confirmed", {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
    });

    let calls = 0;
    const result = await rpc.withRetry(async () => {
      calls++;
      if (calls <= 2) throw new Error("429 Too Many Requests");
      return "recovered";
    }, "test-429");

    expect(result).toBe("recovered");
    expect(calls).toBe(3);
    expect(rpc.stats.rateLimitHits).toBe(2);
    expect(rpc.stats.totalRetries).toBe(2);
  });

  it("does NOT retry non-transient errors", async () => {
    const rpc = new ResilientRpc(["https://ep1.rpc"], "confirmed", {
      maxRetries: 3,
      baseDelayMs: 10,
    });

    let calls = 0;
    await expect(
      rpc.withRetry(async () => {
        calls++;
        throw new Error("custom program error: 0x4");
      }, "test-program-error"),
    ).rejects.toThrow("custom program error: 0x4");

    expect(calls).toBe(1); // No retry
    expect(rpc.stats.totalRetries).toBe(0);
  });

  it("rotates endpoint after exhausting retries", async () => {
    const rpc = new ResilientRpc(
      ["https://ep1.rpc", "https://ep2.rpc"],
      "confirmed",
      { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 },
    );

    let calls = 0;
    const result = await rpc.withRetry(async (conn) => {
      calls++;
      // Fail on first endpoint (2 retries), succeed on second
      if (calls <= 2) throw new Error("429 Too Many Requests");
      return "rotated-ok";
    }, "test-rotation");

    expect(result).toBe("rotated-ok");
    expect(rpc.stats.totalRotations).toBe(1);
  });

  it("throws after all endpoints exhausted", async () => {
    const rpc = new ResilientRpc(
      ["https://ep1.rpc", "https://ep2.rpc"],
      "confirmed",
      { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 50 },
    );

    await expect(
      rpc.withRetry(async () => {
        throw new Error("429 Too Many Requests");
      }, "test-exhaust"),
    ).rejects.toThrow("429");
  });
});

describe("currentEndpoint URL masking", () => {
  it("masks query-param API keys", () => {
    const rpc = new ResilientRpc("https://api.helius.xyz?api-key=secret123", "confirmed");
    expect(rpc.currentEndpoint).not.toContain("secret123");
    expect(rpc.currentEndpoint).toContain("helius.xyz");
  });

  it("masks path-based API keys (QuickNode style)", () => {
    const rpc = new ResilientRpc(
      "https://cool-dawn-hexagon.solana-devnet.quiknode.pro/abc123def456789012/",
      "confirmed",
    );
    expect(rpc.currentEndpoint).not.toContain("abc123def456789012");
    expect(rpc.currentEndpoint).toContain("quiknode.pro");
  });

  it("masks Alchemy-style path keys", () => {
    const rpc = new ResilientRpc(
      "https://solana-devnet.g.alchemy.com/v2/abcdefghijklmnopqr",
      "confirmed",
    );
    expect(rpc.currentEndpoint).not.toContain("abcdefghijklmnopqr");
    expect(rpc.currentEndpoint).toContain("alchemy.com");
  });

  it("preserves simple devnet URLs", () => {
    const rpc = new ResilientRpc("https://api.devnet.solana.com", "confirmed");
    expect(rpc.currentEndpoint).toBe("https://api.devnet.solana.com/");
  });
});
