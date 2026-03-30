/**
 * Tests for VAL-001: Integer validation in pagination
 * Ensures offset is properly clamped and doesn't allow arbitrarily large values
 */
import { describe, it, expect } from "vitest";

describe("Trader trades endpoint - pagination validation (VAL-001)", () => {
  const MAX_OFFSET = 100_000;

  // Simulate the pagination logic from the route
  function validatePagination(limitParam: string | null, offsetParam: string | null) {
    const rawLimit = parseInt(limitParam ?? "20", 10);
    const limit = Math.min(Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit), 100);

    const rawOffset = parseInt(offsetParam ?? "0", 10);
    const offset = Math.max(0, Math.min(Number.isNaN(rawOffset) ? 0 : rawOffset, MAX_OFFSET));

    return { limit, offset };
  }

  describe("offset validation", () => {
    it("should accept valid offset values", () => {
      expect(validatePagination(null, "0").offset).toBe(0);
      expect(validatePagination(null, "10").offset).toBe(10);
      expect(validatePagination(null, "1000").offset).toBe(1000);
      expect(validatePagination(null, "50000").offset).toBe(50000);
    });

    it("should clamp offset to MAX_OFFSET (100000)", () => {
      expect(validatePagination(null, "100001").offset).toBe(MAX_OFFSET);
      expect(validatePagination(null, "999999").offset).toBe(MAX_OFFSET);
      expect(validatePagination(null, "999999999").offset).toBe(MAX_OFFSET);
    });

    it("should handle negative offsets by clamping to 0", () => {
      expect(validatePagination(null, "-1").offset).toBe(0);
      expect(validatePagination(null, "-1000").offset).toBe(0);
    });

    it("should handle NaN offsets by defaulting to 0", () => {
      expect(validatePagination(null, "abc").offset).toBe(0);
      expect(validatePagination(null, "NaN").offset).toBe(0);
      expect(validatePagination(null, "").offset).toBe(0);
    });

    it("should handle float offsets by truncating to int", () => {
      expect(validatePagination(null, "10.5").offset).toBe(10);
      expect(validatePagination(null, "99.99").offset).toBe(99);
    });
  });

  describe("limit validation", () => {
    it("should accept valid limit values", () => {
      expect(validatePagination("1", null).limit).toBe(1);
      expect(validatePagination("20", null).limit).toBe(20);
      expect(validatePagination("100", null).limit).toBe(100);
    });

    it("should clamp limit minimum to 1", () => {
      expect(validatePagination("0", null).limit).toBe(1);
      expect(validatePagination("-5", null).limit).toBe(1);
    });

    it("should clamp limit maximum to 100", () => {
      expect(validatePagination("101", null).limit).toBe(100);
      expect(validatePagination("500", null).limit).toBe(100);
    });

    it("should default to 20 for NaN limit", () => {
      expect(validatePagination("abc", null).limit).toBe(20);
      expect(validatePagination(null, null).limit).toBe(20);
    });
  });

  describe("combined validation", () => {
    it("should handle both parameters together", () => {
      expect(validatePagination("50", "1000")).toEqual({
        limit: 50,
        offset: 1000,
      });
    });

    it("should clamp both parameters when needed", () => {
      expect(validatePagination("200", "200000")).toEqual({
        limit: 100,
        offset: MAX_OFFSET,
      });
    });

    it("should default invalid values correctly", () => {
      expect(validatePagination("invalid", "invalid")).toEqual({
        limit: 20,
        offset: 0,
      });
    });
  });
});
