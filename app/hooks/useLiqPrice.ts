"use client";

import { useMemo } from "react";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useSlabState } from "@/components/providers/SlabProvider";
import { computeLiqPrice } from "@/lib/trading";

/**
 * Phase 2: Returns the liquidation price (as bigint e6) for the current user's
 * open position on the active slab. Returns null when no position exists or
 * when required data is not yet available.
 */
export function useLiqPrice(): bigint | null {
  const realUserAccount = useUserAccount();
  const { params } = useSlabState();

  return useMemo(() => {
    if (!realUserAccount) return null;
    const { account } = realUserAccount;
    if (account.positionSize === 0n) return null;

    const maintenanceBps = params?.maintenanceMarginBps ?? 500n;
    return computeLiqPrice(
      account.entryPrice,
      account.capital,
      account.positionSize,
      maintenanceBps,
    );
  }, [realUserAccount, params]);
}
