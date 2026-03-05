"use client";

import { useWalletCompat } from "@/hooks/useWalletCompat";
import { ProgressBar } from "@/components/ui/ProgressBar";

export interface PositionData {
  pool_symbol: string;
  lp_balance: number;
  est_value_usd: number;
  deposited_usd: number;
  pnl_usd: number;
  pnl_pct: number;
  cooldown_elapsed_slots: number;
  cooldown_total_slots: number;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function slotsToTime(slots: number): string {
  const seconds = Math.round(slots * 0.4);
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.round(seconds / 60)} min`;
}

interface YourPositionProps {
  position?: PositionData | null;
}

export function YourPosition({ position }: YourPositionProps) {
  const { connected } = useWalletCompat();

  if (!connected) {
    return (
      <div className="border border-[var(--border)] bg-[var(--panel-bg)] p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Connect wallet to view your position
        </p>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="border border-[var(--border)] bg-[var(--panel-bg)] p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--text-muted)]">No open positions</p>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">Deposit into a pool to get started</p>
      </div>
    );
  }

  const cooldownRemaining = position.cooldown_total_slots - position.cooldown_elapsed_slots;
  const cooldownComplete = cooldownRemaining <= 0;
  const cooldownPct = position.cooldown_total_slots > 0
    ? position.cooldown_elapsed_slots / position.cooldown_total_slots
    : 1;
  const pnlPositive = position.pnl_usd >= 0;

  return (
    <div className="border border-[var(--border)] bg-[var(--panel-bg)]">
      <div className="px-4 py-2 border-b border-[var(--border)]/30">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--text-secondary)]">// YOUR POSITION</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <span className="text-[var(--text-secondary)]">Pool</span>
            <p className="font-medium text-[var(--text)]">{position.pool_symbol}</p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">LP Balance</span>
            <p className="font-medium text-[var(--text)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {position.lp_balance.toLocaleString()} LP
            </p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">Est. Value</span>
            <p className="font-medium text-[var(--text)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {formatUsd(position.est_value_usd)}
            </p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">Deposited</span>
            <p className="font-medium text-[var(--text)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {formatUsd(position.deposited_usd)}
            </p>
          </div>
        </div>

        {/* PnL */}
        <div className="text-[12px]">
          <span className="text-[var(--text-secondary)]">PnL</span>
          <p
            className={`font-semibold tabular-nums ${pnlPositive ? "text-[var(--long)]" : "text-[var(--short)]"}`}
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {pnlPositive ? "+" : ""}{formatUsd(position.pnl_usd)} ({pnlPositive ? "+" : ""}{position.pnl_pct.toFixed(2)}%)
          </p>
        </div>

        {/* Cooldown */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-[var(--text-secondary)]">Cooldown</span>
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {cooldownComplete
                ? "Complete"
                : `${cooldownRemaining.toLocaleString()} slots (${slotsToTime(cooldownRemaining)})`}
            </span>
          </div>
          <ProgressBar value={cooldownPct} height={8} />
        </div>

        {/* Withdraw button */}
        <button
          disabled={!cooldownComplete}
          className={`w-full py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 ${
            cooldownComplete
              ? "border border-[var(--cyan)]/50 bg-[var(--cyan)]/[0.10] text-[var(--cyan)] hover:border-[var(--cyan)] hover:bg-[var(--cyan)]/[0.18]"
              : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] cursor-not-allowed"
          }`}
        >
          {cooldownComplete ? "Withdraw LP →" : `Withdraw in ${cooldownRemaining.toLocaleString()} slots`}
        </button>
      </div>
    </div>
  );
}
