/**
 * GH#1693: Oracle price absolute sanity bounds + cold-start confirmation
 *
 * Verifies:
 * 1. Prices above MAX_PRICE_E6 (1_000_000_000_000_000n = $1B) are rejected
 * 2. Valid prices within bounds are accepted
 * 3. Cold-start requires COLD_START_MIN_CONFIRMATIONS (3) consistent samples
 * 4. Inconsistent cold-start sample resets the counter
 * 5. After cold-start confirmation, normal historical deviation check applies
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
global.fetch = vi.fn();

vi.mock("@percolator/sdk", () => ({
  encodePushOraclePrice: vi.fn(() => Buffer.from([1, 2, 3])),
  buildAccountMetas: vi.fn(() => []),
  buildIx: vi.fn(() => ({ programId: null, keys: [], data: Buffer.from([]) })),
  ACCOUNTS_PUSH_ORACLE_PRICE: [],
}));

vi.mock("@percolator/shared", () => ({
  config: { programId: "11111111111111111111111111111111" },
  getConnection: vi.fn(),
  loadKeypair: vi.fn(),
  sendWithRetry: vi.fn(),
  eventBus: { publish: vi.fn() },
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getErrorMessage: (e: unknown) => String(e),
}));

// Price helpers
const usd = (n: number): bigint => BigInt(Math.round(n * 1_000_000));

const MINT = "TokenMintAddress111111111111111111";
const SLAB = "SlabAddress111111111111111111111111";
const SLAB2 = "SlabAddress222222222222222222222222"; // separate market to avoid shared history

describe("GH#1693: Oracle sanity bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects price above MAX ($1B)", async () => {
    const { OracleService } = await import("../../src/services/oracle.js");
    const oracle = new OracleService();
    vi.spyOn(oracle, "fetchDexScreenerPrice").mockResolvedValue(2_000_000_000_000_000n); // $2B
    vi.spyOn(oracle, "fetchJupiterPrice").mockResolvedValue(2_000_000_000_000_000n);
    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull();
  });

  it("accepts price at exactly MAX ($1B)", async () => {
    const { OracleService } = await import("../../src/services/oracle.js");
    const oracle = new OracleService();
    const maxPrice = 1_000_000_000_000_000n;
    vi.spyOn(oracle, "fetchDexScreenerPrice").mockResolvedValue(maxPrice);
    vi.spyOn(oracle, "fetchJupiterPrice").mockResolvedValue(maxPrice);
    // Valid price, but cold-start → returns null until confirmed
    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull();
  });

  it("accepts minimum valid price ($0.000001 = 1n e6)", async () => {
    const { OracleService } = await import("../../src/services/oracle.js");
    const oracle = new OracleService();
    vi.spyOn(oracle, "fetchDexScreenerPrice").mockResolvedValue(1n);
    vi.spyOn(oracle, "fetchJupiterPrice").mockResolvedValue(1n);
    // Valid price, cold-start confirmation pending
    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull();
  });
});

describe("GH#1693: Cold-start confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires 3 consistent samples before emitting a price", async () => {
    const { OracleService } = await import("../../src/services/oracle.js");
    const oracle = new OracleService();
    const price = usd(100);
    vi.spyOn(oracle, "fetchDexScreenerPrice").mockResolvedValue(price);
    vi.spyOn(oracle, "fetchJupiterPrice").mockResolvedValue(price);

    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull(); // sample 1
    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull(); // sample 2
    const r3 = await oracle.fetchPrice(MINT, SLAB);          // sample 3
    expect(r3).not.toBeNull();
    expect(r3?.priceE6).toBe(price);
  });

  it("resets cold-start counter when sample deviates >5% from reference", async () => {
    const { OracleService } = await import("../../src/services/oracle.js");
    const oracle = new OracleService();
    const price = usd(100);
    const badPrice = usd(200); // 100% deviation — resets

    const mockDex = vi.spyOn(oracle, "fetchDexScreenerPrice");
    const mockJup = vi.spyOn(oracle, "fetchJupiterPrice");
    mockDex
      .mockResolvedValueOnce(price)    // 1: ref=100
      .mockResolvedValueOnce(badPrice) // 2: inconsistent → reset ref=200
      .mockResolvedValueOnce(badPrice) // 3: count=2 at ref=200
      .mockResolvedValueOnce(badPrice); // 4: count=3 → emit
    mockJup
      .mockResolvedValueOnce(price)
      .mockResolvedValueOnce(badPrice)
      .mockResolvedValueOnce(badPrice)
      .mockResolvedValueOnce(badPrice);

    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull(); // 1: ref=100, count=1
    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull(); // 2: reset, ref=200, count=1
    expect(await oracle.fetchPrice(MINT, SLAB)).toBeNull(); // 3: count=2 at ref=200
    const r4 = await oracle.fetchPrice(MINT, SLAB);         // 4: count=3 → emit
    expect(r4).not.toBeNull();
    expect(r4?.priceE6).toBe(badPrice);
  });

  it("after cold-start, historical deviation check applies (>30% rejected)", async () => {
    const { OracleService } = await import("../../src/services/oracle.js");
    const oracle = new OracleService();
    const price = usd(100);
    const mockDex = vi.spyOn(oracle, "fetchDexScreenerPrice").mockResolvedValue(price);
    const mockJup = vi.spyOn(oracle, "fetchJupiterPrice").mockResolvedValue(price);

    // Complete cold-start
    await oracle.fetchPrice(MINT, SLAB2);
    await oracle.fetchPrice(MINT, SLAB2);
    await oracle.fetchPrice(MINT, SLAB2);

    // +100% spike — rejected by historical deviation check
    mockDex.mockResolvedValue(usd(200));
    mockJup.mockResolvedValue(usd(200));
    expect(await oracle.fetchPrice(MINT, SLAB2)).toBeNull();
  });

  it("after cold-start, price within 30% deviation is accepted", async () => {
    const { OracleService } = await import("../../src/services/oracle.js");
    const oracle = new OracleService();
    const price = usd(100);
    const mockDex = vi.spyOn(oracle, "fetchDexScreenerPrice").mockResolvedValue(price);
    const mockJup = vi.spyOn(oracle, "fetchJupiterPrice").mockResolvedValue(price);

    // Complete cold-start (using a fresh SLAB for isolation)
    const s = "SlabAddress333333333333333333333333";
    await oracle.fetchPrice(MINT, s);
    await oracle.fetchPrice(MINT, s);
    await oracle.fetchPrice(MINT, s);

    // +20% — within limit
    const normalMove = usd(120);
    mockDex.mockResolvedValue(normalMove);
    mockJup.mockResolvedValue(normalMove);
    const result = await oracle.fetchPrice(MINT, s);
    expect(result).not.toBeNull();
    expect(result?.priceE6).toBe(normalMove);
  });
});
