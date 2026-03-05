"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";
import type { StakePoolData } from "@/app/api/stake/pools/route";

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const POOL_COLORS: Record<string, string> = {
  SOL: "var(--accent)",
  BTC: "var(--warning)",
  ETH: "var(--cyan)",
};

interface PoolCardProps {
  pool: StakePoolData;
  onDeposit: (poolId: string) => void;
}

export function PoolCard({ pool, onDeposit }: PoolCardProps) {
  const capRatio = pool.cap_usd > 0 ? pool.deposited_usd / pool.cap_usd : 0;
  const initials = pool.token.slice(0, 2);
  const iconColor = POOL_COLORS[pool.token] ?? "var(--accent)";

  return (
    <article className="group relative border border-[var(--border)] bg-[var(--panel-bg)] p-4 sm:p-5 transition-colors duration-200 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ backgroundColor: `color-mix(in srgb, ${iconColor} 15%, transparent)`, color: iconColor }}
          >
            {initials}
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text)]">{pool.symbol}</h3>
            <p className="text-[10px] text-[var(--text-muted)]">POOL</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-[12px]">
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">TVL</span>
          <span className="font-medium text-[var(--text)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{formatUsd(pool.tvl_usd)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">APR</span>
          <span className="font-semibold text-[var(--cyan)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{pool.apr_pct.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">Cap</span>
          <span className="text-[var(--text-muted)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{Math.round(capRatio * 100)}% full</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">Cooldown</span>
          <span className="text-[var(--text-muted)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{pool.cooldown_slots.toLocaleString()} slots</span>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar value={capRatio} height={4} />
      </div>

      <button
        onClick={() => onDeposit(pool.id)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 border border-[var(--accent)]/30 bg-transparent py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--accent)] transition-all duration-200 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/[0.06]"
      >
        Deposit
      </button>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--accent)]/0 transition-all duration-300 group-hover:bg-[var(--accent)]/30" />
    </article>
  );
}
