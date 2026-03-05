"use client";

import { useState } from "react";
import { useWalletCompat } from "@/hooks/useWalletCompat";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { StakePoolData } from "@/app/api/stake/pools/route";

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

interface DepositWidgetProps {
  pools: StakePoolData[];
  selectedPoolId?: string;
  onPoolChange?: (poolId: string) => void;
}

export function DepositWidget({ pools, selectedPoolId, onPoolChange }: DepositWidgetProps) {
  const { connected } = useWalletCompat();
  const [localPoolId, setLocalPoolId] = useState(pools[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  const activePoolId = selectedPoolId ?? localPoolId;
  const pool = pools.find((p) => p.id === activePoolId) ?? pools[0];
  const amountNum = parseFloat(amount) || 0;

  // LP estimate: price_per_lp = deposited / total_lp (default 1.0 for mock)
  const pricePerLp = 1.0;
  const lpEstimate = amountNum / pricePerLp;

  const capRatio = pool ? pool.deposited_usd / pool.cap_usd : 0;

  function handlePoolChange(id: string) {
    setLocalPoolId(id);
    onPoolChange?.(id);
  }

  return (
    <div id="deposit" className="border border-[var(--border)] bg-[var(--panel-bg)]">
      <div className="px-4 py-2 border-b border-[var(--border)]/30">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--text-secondary)]">// DEPOSIT</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Pool selector */}
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--text-secondary)]">Select Pool</label>
          <select
            value={activePoolId}
            onChange={(e) => handlePoolChange(e.target.value)}
            className="w-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]/50"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {pools.map((p) => (
              <option key={p.id} value={p.id}>{p.symbol}</option>
            ))}
          </select>
        </div>

        {/* Amount input */}
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--text-secondary)]">Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="flex-1 border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)]/50 tabular-nums"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            />
            <button className="border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)]">
              MAX
            </button>
          </div>
        </div>

        {/* LP estimate */}
        {amountNum > 0 && (
          <div className="text-[12px] text-[var(--text-secondary)]">
            You will receive ≈{" "}
            <span className="font-medium text-[var(--text)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {lpEstimate.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pool?.symbol}-LP
            </span>
          </div>
        )}

        {/* Pool cap bar */}
        {pool && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-[var(--text-secondary)]">Pool cap</span>
              <span className="text-[10px] text-[var(--text-muted)] tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                {formatUsd(pool.deposited_usd)} / {formatUsd(pool.cap_usd)} ({Math.round(capRatio * 100)}%)
              </span>
            </div>
            <ProgressBar value={capRatio} height={6} />
          </div>
        )}

        {/* Cooldown info */}
        {pool && (
          <p className="text-[10px] text-[var(--text-muted)]">
            Cooldown period: {pool.cooldown_slots.toLocaleString()} slots ({slotsToTime(pool.cooldown_slots)} before withdrawal)
          </p>
        )}

        {/* CTA */}
        {!connected ? (
          <button className="w-full py-3 border border-[var(--border)] bg-[var(--bg)] text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] cursor-not-allowed">
            Connect Wallet
          </button>
        ) : (
          <button
            disabled={amountNum <= 0}
            className={`w-full py-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 ${
              amountNum > 0
                ? "border border-[var(--accent)]/50 bg-[var(--accent)]/[0.10] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.18]"
                : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] cursor-not-allowed"
            }`}
          >
            Deposit →
          </button>
        )}
      </div>
    </div>
  );
}
