"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { StakePoolData } from "@/app/api/stake/pools/route";
import type { PositionData } from "@/components/stake/YourPosition";

const StakeHero = dynamic(() => import("@/components/stake/StakeHero").then((m) => ({ default: m.StakeHero })), { ssr: false });
const PoolList = dynamic(() => import("@/components/stake/PoolList").then((m) => ({ default: m.PoolList })), { ssr: false });
const DepositWidget = dynamic(() => import("@/components/stake/DepositWidget").then((m) => ({ default: m.DepositWidget })), { ssr: false });
const YourPosition = dynamic(() => import("@/components/stake/YourPosition").then((m) => ({ default: m.YourPosition })), { ssr: false });

const MOCK_POSITION: PositionData = {
  pool_symbol: "SOL-PERP-POOL",
  lp_balance: 24_800,
  est_value_usd: 25_100,
  deposited_usd: 24_000,
  pnl_usd: 1_100,
  pnl_pct: 4.58,
  cooldown_elapsed_slots: 2400,
  cooldown_total_slots: 3200,
};

export default function StakePage() {
  const [pools, setPools] = useState<StakePoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoolId, setSelectedPoolId] = useState<string | undefined>();
  const [totalStaked, setTotalStaked] = useState(0);
  const [activePools, setActivePools] = useState(0);
  const [avgApr, setAvgApr] = useState(0);

  useEffect(() => {
    document.title = "Stake — Percolator";
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    fetch("/api/stake/pools", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { pools: StakePoolData[]; total_staked_usd: number; active_pools: number; avg_apr_pct: number }) => {
        setPools(data.pools ?? []);
        setTotalStaked(data.total_staked_usd ?? 0);
        setActivePools(data.active_pools ?? 0);
        setAvgApr(data.avg_apr_pct ?? 0);
        if ((data.pools ?? []).length > 0 && !selectedPoolId) {
          setSelectedPoolId(data.pools[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDeposit(poolId: string) {
    setSelectedPoolId(poolId);
    document.getElementById("deposit")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-x-0 top-0 h-48 bg-grid pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16">
        {/* Hero — full width */}
        <StakeHero
          totalStaked={totalStaked}
          yourDeposits={MOCK_POSITION.est_value_usd}
          activePools={activePools}
          avgApr={avgApr}
          loading={loading}
        />

        {/* Desktop: 3/5 PoolList + 2/5 DepositWidget + YourPosition */}
        {/* Mobile: YourPosition -> DepositWidget -> PoolList */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Mobile-only: YourPosition first */}
          <div className="lg:hidden space-y-4">
            <YourPosition position={MOCK_POSITION} />
            <DepositWidget pools={pools} selectedPoolId={selectedPoolId} onPoolChange={setSelectedPoolId} />
          </div>

          {/* Left column: Pool list (3/5) */}
          <div className="lg:col-span-3">
            <PoolList pools={pools} loading={loading} onDeposit={handleDeposit} />
          </div>

          {/* Right column: Deposit + Position (2/5) — desktop only */}
          <div className="hidden lg:col-span-2 lg:block space-y-4">
            <DepositWidget pools={pools} selectedPoolId={selectedPoolId} onPoolChange={setSelectedPoolId} />
            <YourPosition position={MOCK_POSITION} />
          </div>
        </div>
      </div>
    </div>
  );
}
