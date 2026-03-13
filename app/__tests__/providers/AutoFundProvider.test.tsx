/**
 * GH#1120: Tests for AutoFundProvider windowed result behavior
 *
 * Ensures that `fundResult.funded` expires after FUNDED_WINDOW_MS (30s)
 * so navigating to a second trade page does NOT trigger auto-deposit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { FC, ReactNode } from "react";

// Track the mock return value so we can change it mid-test
let mockAutoFundReturn = { funding: false, result: null as any, error: null };

vi.mock("@/hooks/useAutoFund", () => ({
  useAutoFund: () => mockAutoFundReturn,
}));

vi.mock("@/hooks/useWalletCompat", () => ({
  useWalletCompat: vi.fn(() => ({
    publicKey: null,
    connected: false,
  })),
  useConnectionCompat: vi.fn(() => ({
    connection: {},
  })),
}));

describe("AutoFundProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAutoFundReturn = { funding: false, result: null, error: null };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should expose null result initially", async () => {
    const { AutoFundProvider, useAutoFundResult } = await import(
      "@/components/providers/AutoFundProvider"
    );

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <AutoFundProvider>{children}</AutoFundProvider>
    );

    const { result } = renderHook(() => useAutoFundResult(), { wrapper });
    expect(result.current.result).toBeNull();
    expect(result.current.funding).toBe(false);
  });

  it("should expose funded result when auto-fund succeeds", async () => {
    mockAutoFundReturn = {
      funding: false,
      result: { funded: true, sol_airdropped: true, usdc_minted: true, sol_amount: 2, usdc_amount: 1000 },
      error: null,
    };

    const { AutoFundProvider, useAutoFundResult } = await import(
      "@/components/providers/AutoFundProvider"
    );

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <AutoFundProvider>{children}</AutoFundProvider>
    );

    const { result } = renderHook(() => useAutoFundResult(), { wrapper });
    expect(result.current.result?.funded).toBe(true);
  });

  it("should clear funded result after 30 seconds (GH#1120)", async () => {
    mockAutoFundReturn = {
      funding: false,
      result: { funded: true, sol_airdropped: true, usdc_minted: true, sol_amount: 2, usdc_amount: 1000 },
      error: null,
    };

    const { AutoFundProvider, useAutoFundResult } = await import(
      "@/components/providers/AutoFundProvider"
    );

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <AutoFundProvider>{children}</AutoFundProvider>
    );

    const { result } = renderHook(() => useAutoFundResult(), { wrapper });
    expect(result.current.result?.funded).toBe(true);

    // Advance past the 30s window
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    expect(result.current.result).toBeNull();
  });

  it("should NOT clear non-funded result", async () => {
    mockAutoFundReturn = {
      funding: false,
      result: { funded: false, sol_airdropped: false, usdc_minted: false },
      error: null,
    };

    const { AutoFundProvider, useAutoFundResult } = await import(
      "@/components/providers/AutoFundProvider"
    );

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <AutoFundProvider>{children}</AutoFundProvider>
    );

    const { result } = renderHook(() => useAutoFundResult(), { wrapper });
    expect(result.current.result?.funded).toBe(false);

    // Advance time — should NOT clear since it wasn't funded
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    // Non-funded result persists (no timer set)
    expect(result.current.result?.funded).toBe(false);
  });
});
