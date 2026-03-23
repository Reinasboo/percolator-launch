"use client";

import { FC, useState, useRef, useEffect, useCallback } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle, ColorType, CrosshairMode } from "lightweight-charts";
import { useSlabState } from "@/components/providers/SlabProvider";
import { useLivePrice } from "@/hooks/useLivePrice";
import { useTokenChart } from "@/hooks/useTokenChart";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useMarketConfig } from "@/hooks/useMarketConfig";
import { useEngineState } from "@/hooks/useEngineState";
import { useLiqPrice } from "@/hooks/useLiqPrice";
import { ChartEmptyState } from "./ChartEmptyState";
import { isMockMode } from "@/lib/mock-mode";
import { isMockSlab, getMockUserAccount } from "@/lib/mock-trade-data";

type ChartType = "line" | "candle";
// Phase 2: added 15m timeframe
type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "7d" | "30d";

interface PricePoint {
  timestamp: number;
  price: number;
}

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const CANDLE_INTERVAL_MS = 5 * 60 * 1000;

// Phase 2: timeframes that benefit from auto-polling
const POLLING_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

function aggregateCandles(prices: PricePoint[], intervalMs: number) {
  if (prices.length === 0) return [];
  const candles: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
  let current: (typeof candles)[0] | null = null;
  prices.forEach((point) => {
    const candleStart = Math.floor(point.timestamp / intervalMs) * intervalMs;
    if (!current || current.timestamp !== candleStart) {
      if (current) candles.push(current);
      current = { timestamp: candleStart, open: point.price, high: point.price, low: point.price, close: point.price, volume: 0 };
    } else {
      current.high = Math.max(current.high, point.price);
      current.low = Math.min(current.low, point.price);
      current.close = point.price;
    }
  });
  if (current) candles.push(current);
  return candles;
}

// Phase 2: compact position summary shown on chart when wallet is connected
interface PositionSummaryProps {
  slabAddress: string;
}

function PositionSummary({ slabAddress }: PositionSummaryProps) {
  const realUserAccount = useUserAccount();
  const mockMode = isMockMode() && isMockSlab(slabAddress);
  const userAccount = realUserAccount ?? (mockMode ? getMockUserAccount(slabAddress) : null);

  if (!userAccount) return null;
  const { account } = userAccount;
  if (account.positionSize === 0n) return null;

  const isLong = account.positionSize > 0n;
  const direction = isLong ? "LONG" : "SHORT";
  const dirColor = isLong ? "text-green-400" : "text-red-400";

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-none border border-[var(--border)]/60 bg-[var(--bg)]/90 px-2 py-1 backdrop-blur-sm">
      <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${dirColor}`}>{direction}</span>
      <span className="text-[9px] text-[var(--text-dim)]">position open</span>
    </div>
  );
}

export const TradingChart: FC<{ slabAddress: string; mintAddress?: string }> = ({
  slabAddress,
  mintAddress,
}) => {
  const { config } = useSlabState();
  const { priceUsd } = useLivePrice();
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [oraclePrices, setOraclePrices] = useState<PricePoint[]>([]);

  // Phase 2: liq price overlay
  const realUserAccount = useUserAccount();
  const marketConfig = useMarketConfig();
  const { params } = useSlabState();
  const liqPriceE6 = useLiqPrice();

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);
  const liqLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);

  const {
    candles: externalCandles,
    status: externalStatus,
    poolAddress,
  } = useTokenChart(mintAddress ?? null, timeframe);

  const hasExternalData = externalStatus === "success" && externalCandles.length > 0;

  // Fetch oracle price history
  useEffect(() => {
    fetch(`/api/markets/${slabAddress}/prices`)
      .then((r) => r.json())
      .then((d) => {
        const apiPrices = (d.prices ?? []).map((p: { price_e6: string; timestamp: number }) => ({
          timestamp: p.timestamp,
          price: parseInt(p.price_e6) / 1e6,
        }));
        setOraclePrices(apiPrices);
      })
      .catch(() => {});
  }, [slabAddress]);

  // Live price updates
  useEffect(() => {
    if (!config || !priceUsd) return;
    const now = Date.now();
    setOraclePrices((prev) => {
      const last = prev[prev.length - 1];
      if (last && now - last.timestamp < 5000) return prev;
      return [...prev, { timestamp: now, price: priceUsd }].slice(-1000);
    });
  }, [config, priceUsd]);

  // Derive data
  const oracleFiltered = (() => {
    const cutoff = Date.now() - TIMEFRAME_MS[timeframe];
    return oraclePrices.filter((p) => p.timestamp >= cutoff);
  })();

  const candleData = (() => {
    if (hasExternalData) return externalCandles as { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
    return aggregateCandles(oracleFiltered, CANDLE_INTERVAL_MS);
  })();

  const lineData = (() => {
    if (hasExternalData) return externalCandles.map((c) => ({ timestamp: c.timestamp, price: c.close }));
    return oracleFiltered;
  })();

  const totalDataPoints = candleData.length + lineData.length;

  // GH#1625: sparse-data guard
  const effectiveSparse =
    (chartType === "candle" && candleData.length < 2) ||
    (chartType === "line" && lineData.length < 2);

  // Phase 2: volume has data (used to show empty state in volume pane)
  const hasVolumeData = candleData.some((c) => (c.volume ?? 0) > 0);

  // Create/destroy chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0D0D0F" },
        textColor: "rgba(255,255,255,0.45)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      liqLineRef.current = null;
    };
  }, []);

  // Update series when data or chartType changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }
    if (volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    priceLineRef.current = null;
    liqLineRef.current = null;

    if (chartType === "candle" && candleData.length > 0) {
      const series = chart.addCandlestickSeries({
        upColor: "#22d3ee",
        downColor: "#ef4444",
        borderDownColor: "#ef4444",
        borderUpColor: "#22d3ee",
        wickDownColor: "#ef4444",
        wickUpColor: "#22d3ee",
      });

      const formatted = candleData.map((c) => ({
        time: (Math.floor(c.timestamp / 1000)) as import("lightweight-charts").UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      series.setData(formatted);
      seriesRef.current = series;

      // Phase 2: Volume histogram — always add series; use sentinel 0.001 when
      // no real volume data exists so the pane renders (showing the "no data" label
      // via the overlay div below, not via lwc itself).
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        // Phase 2: increase top margin so volume pane is visually taller and
        // clearly visible even at desktop 1440px. Was 0.85 — now 0.80 (20% height).
        scaleMargins: { top: 0.80, bottom: 0 },
      });
      const volumeData = candleData.map((c) => ({
        time: (Math.floor(c.timestamp / 1000)) as import("lightweight-charts").UTCTimestamp,
        // Phase 2: use a tiny sentinel value so lwc renders the pane even when vol=0
        value: (c.volume ?? 0) > 0 ? c.volume : 0.001,
        color: c.close >= c.open ? "rgba(34,211,238,0.6)" : "rgba(239,68,68,0.6)",
      }));
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;

      // Mark price line
      if (priceUsd != null) {
        priceLineRef.current = series.createPriceLine({
          price: priceUsd,
          color: "#9945FF",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Mark",
        });
      }

      // Phase 2: Liq price overlay — show orange dashed line when user has position
      const liqPriceNum = liqPriceE6 != null && liqPriceE6 > 0n ? Number(liqPriceE6) / 1e6 : null;
      if (liqPriceNum != null && liqPriceNum > 0) {
        liqLineRef.current = series.createPriceLine({
          price: liqPriceNum,
          color: "#f97316",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Liq",
        });
      }
    } else if (chartType === "line" && lineData.length > 0) {
      const series = chart.addLineSeries({
        color: "#22d3ee",
        lineWidth: 2,
      });
      const formatted = lineData.map((p) => ({
        time: (Math.floor(p.timestamp / 1000)) as import("lightweight-charts").UTCTimestamp,
        value: p.price,
      }));
      series.setData(formatted);
      seriesRef.current = series as ISeriesApi<"Candlestick" | "Line">;

      // Mark price line on line series
      if (priceUsd != null) {
        priceLineRef.current = series.createPriceLine({
          price: priceUsd,
          color: "#9945FF",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Mark",
        });
      }

      // Phase 2: Liq price on line chart too
      const liqPriceNum = liqPriceE6 != null && liqPriceE6 > 0n ? Number(liqPriceE6) / 1e6 : null;
      if (liqPriceNum != null && liqPriceNum > 0) {
        liqLineRef.current = series.createPriceLine({
          price: liqPriceNum,
          color: "#f97316",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Liq",
        });
      }
    }

    chart.timeScale().fitContent();
  }, [chartType, candleData, lineData, priceUsd, liqPriceE6]);

  // Update mark price line when live price changes
  useEffect(() => {
    if (priceLineRef.current && priceUsd != null) {
      priceLineRef.current.applyOptions({ price: priceUsd });
    }
  }, [priceUsd]);

  // Compute price stats for header
  const activeData = lineData.length > 0 ? lineData : oracleFiltered;
  const currentPrice = activeData[activeData.length - 1]?.price ?? priceUsd ?? 0;
  const firstPrice = activeData[0]?.price ?? currentPrice;
  const priceChange = currentPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
  const isUp = priceChange >= 0;

  if (totalDataPoints === 0 || effectiveSparse) {
    return (
      <ChartEmptyState
        currentPrice={priceUsd ?? undefined}
        heightClass="h-[40svh] sm:h-[400px]"
      />
    );
  }

  return (
    <div className="rounded-none border border-[var(--border)] bg-[var(--bg)] p-3">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-y-2">
        <div className="min-w-0">
          <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: isUp ? "var(--long)" : "var(--short)" }}>
            ${currentPrice.toFixed(currentPrice < 1 ? 4 : 2)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: isUp ? "var(--long)" : "var(--short)" }}>
              {isUp ? "+" : ""}{priceChange.toFixed(4)} ({isUp ? "+" : ""}{priceChangePercent.toFixed(2)}%)
            </span>
            {hasExternalData ? (
              <span
                className="text-[9px] font-medium uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-sm"
                style={{ background: "var(--accent)/0.1", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}
                title={poolAddress ? `GeckoTerminal pool: ${poolAddress}` : "Source: GeckoTerminal"}
              >
                DEX
              </span>
            ) : (
              mintAddress && externalStatus !== "idle" && (
                <span
                  className="text-[9px] font-medium uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-sm"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                  title="Showing oracle price history (no DEX data found)"
                >
                  Oracle
                </span>
              )
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-none border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
            <button
              onClick={() => setChartType("line")}
              className={`rounded-none px-2 py-1 text-xs transition-colors ${
                chartType === "line"
                  ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType("candle")}
              className={`rounded-none px-2 py-1 text-xs transition-colors ${
                chartType === "candle"
                  ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Candle
            </button>
          </div>

          {/* Phase 2: timeframe bar with 15m added */}
          <div className="flex gap-1 rounded-none border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
            {(["1m", "5m", "15m", "1h", "4h", "1d", "7d", "30d"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded-none px-2 py-1 text-xs transition-colors ${
                  timeframe === tf
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart container — relative so PositionSummary overlay can be absolute */}
      {/* Phase 2: mobile uses 40svh, desktop keeps 500px */}
      <div className="relative">
        <div ref={containerRef} className="w-full h-[40svh] lg:h-[500px]" />

        {/* Phase 2: Volume no-data overlay — shown when volume pane exists but all volumes are 0 */}
        {chartType === "candle" && !hasVolumeData && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-[20%] items-center justify-center border-t border-[var(--border)]/30">
            <span className="text-[9px] text-[var(--text-dim)] uppercase tracking-[0.12em]">
              ── Volume (no data) ──
            </span>
          </div>
        )}

        {/* Phase 2: Position summary badge overlay */}
        <PositionSummary slabAddress={slabAddress} />
      </div>
    </div>
  );
};
