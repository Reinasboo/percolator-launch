"use client";

import { FC } from "react";
import { useLivePrice } from "@/hooks/useLivePrice";
import { useMarketInfo } from "@/hooks/useMarketInfo";
import { useEngineState } from "@/hooks/useEngineState";

interface MarketInfoBarProps {
  slabAddress: string;
  symbol: string;
  logoUrl?: string | null;
}

function formatCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fundingRateBpsToHourly(rateBps: bigint): number {
  return ((Number(rateBps) * 9000) / 10000) / 100;
}

export const MarketInfoBar: FC<MarketInfoBarProps> = ({ slabAddress, symbol }) => {
  const { priceUsd, change24h } = useLivePrice();
  const { market } = useMarketInfo(slabAddress);
  const { fundingRate } = useEngineState();

  const priceDisplay = priceUsd != null
    ? `$${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd < 1 ? priceUsd.toFixed(4) : priceUsd.toFixed(2)}`
    : "—";

  const has24hChange = change24h != null;
  const isUp = (change24h ?? 0) >= 0;

  const fundingHourly = fundingRate != null ? fundingRateBpsToHourly(fundingRate) : null;
  const fundingColor = fundingHourly != null ? (fundingHourly < 0 ? "text-orange-400" : "text-green-400") : "text-[var(--text)]";

  const volume = market?.volume_24h as number | null | undefined;
  const oi = market?.total_open_interest as number | null | undefined;

  return (
    <div className="bg-[var(--bg)]/95 border-b border-[var(--border)]/50 px-4 py-2 flex items-center gap-4 overflow-x-auto whitespace-nowrap">
      {/* Symbol */}
      <span className="text-sm font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-mono)" }}>
        {symbol}/USD
      </span>

      <span className="h-3.5 w-px bg-[var(--border)]/40 shrink-0" />

      {/* Mark Price */}
      <span
        className={`text-lg font-bold tabular-nums ${has24hChange ? (isUp ? "text-green-400" : "text-red-400") : "text-[var(--text)]"}`}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {priceDisplay}
      </span>

      {/* 24h Change */}
      {has24hChange && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${isUp ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {isUp ? "+" : ""}{change24h!.toFixed(2)}%
        </span>
      )}

      <span className="h-3.5 w-px bg-[var(--border)]/40 shrink-0" />

      {/* Volume */}
      <span className="text-[10px] text-[var(--text-muted)]">
        Vol: <span className="text-[var(--text)]">{formatCompact(volume as number)}</span>
      </span>

      {/* OI */}
      <span className="text-[10px] text-[var(--text-muted)]">
        OI: <span className="text-[var(--text)]">{formatCompact(oi as number)}</span>
      </span>

      {/* Funding */}
      {fundingHourly != null && (
        <span className="text-[10px] text-[var(--text-muted)]">
          Funding: <span className={fundingColor}>{fundingHourly >= 0 ? "+" : ""}{fundingHourly.toFixed(4)}%</span>
          <span className="text-[var(--text-dim)]"> / 8h</span>
        </span>
      )}
    </div>
  );
};
