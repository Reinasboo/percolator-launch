"use client";

import { useState, useMemo } from "react";
import { PoolCard } from "./PoolCard";
import { ShimmerSkeleton } from "@/components/ui/ShimmerSkeleton";
import type { StakePoolData } from "@/app/api/stake/pools/route";

type SortKey = "apr" | "tvl" | "cap";

interface PoolListProps {
  pools: StakePoolData[];
  loading: boolean;
  onDeposit: (poolId: string) => void;
}

export function PoolList({ pools, loading, onDeposit }: PoolListProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("apr");

  const filtered = useMemo(() => {
    let result = pools;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.symbol.toLowerCase().includes(q) || p.token.toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      if (sortBy === "apr") return b.apr_pct - a.apr_pct;
      if (sortBy === "tvl") return b.tvl_usd - a.tvl_usd;
      return (b.deposited_usd / b.cap_usd) - (a.deposited_usd / a.cap_usd);
    });
  }, [pools, search, sortBy]);

  return (
    <section id="pools">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          // AVAILABLE POOLS
        </span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pools..."
            className="border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)]/50 w-36"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-secondary)] outline-none"
          >
            <option value="apr">Sort: APR</option>
            <option value="tvl">Sort: TVL</option>
            <option value="cap">Sort: Cap</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-[var(--border)] bg-[var(--panel-bg)] p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <ShimmerSkeleton className="h-8 w-8 rounded-full" />
                <div>
                  <ShimmerSkeleton className="h-4 w-24 mb-1" />
                  <ShimmerSkeleton className="h-3 w-12" />
                </div>
              </div>
              <ShimmerSkeleton className="h-3 w-full" />
              <ShimmerSkeleton className="h-3 w-full" />
              <ShimmerSkeleton className="h-3 w-full" />
              <ShimmerSkeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[var(--border)] bg-[var(--panel-bg)] p-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--text-muted)]">No pools found</p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">Try adjusting your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pool) => (
            <PoolCard key={pool.id} pool={pool} onDeposit={onDeposit} />
          ))}
        </div>
      )}
    </section>
  );
}
