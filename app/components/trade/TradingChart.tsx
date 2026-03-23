"use client";

import { FC, useState, useRef, useEffect, useCallback } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle, ColorType, CrosshairMode } from "lightweight-charts";
import { useSlabState } from "@/components/providers/SlabProvider";
import { useLivePrice } from "@/hooks/useLivePrice";
import { useTokenChart } from "@/hooks/useTokenChart";
import { ChartEmptyState } from "./ChartEmptyState";

type ChartType = "line" | "candle";
type Timeframe = "1m" | "5m" | "1h" | "4h" | "1d" | "7d" | "30d";

interface PricePoint {
  timestamp: number;
  price: number;
}

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const CANDLE_INTERVAL_MS = 5 * 60 * 1000;

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

export const TradingChart: FC<{ slabAddress: string; mintAddress?: string }> = ({
  slabAddress,
  mintAddress,
}) => {
  const { config } = useSlabState();
  const { priceUsd } = useLivePrice();
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [oraclePrices, setOraclePrices] = useState<PricePoint[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);

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

  // GH#1625: sparse-data guard for lwc renderer.
  // lightweight-charts renders a single candle with open=high=low=close as an
  // invisible hairline, leaving the chart visually blank on uncranked markets.
  // Mirror the SVG guard from PR #1624: if fewer than 2 data points, show ChartEmptyState.
  const effectiveSparse =
    (chartType === "candle" && candleData.length < 2) ||
    (chartType === "line" && lineData.length < 2);

  // Create/destroy chart
  useEffect(() => {
    if (!containerRef.current) return;

    // GH#1625 / GH#1628: Use autoSize so lightweight-charts manages its own
    // dimensions via an internal ResizeObserver. This prevents blank/black charts
    // when clientWidth/clientHeight are 0 at mount time (no flex parent, or
    // narrow mobile viewports like 375px). The container must have an explicit
    // CSS height — see the div below (h-[300px] lg:h-[500px]).
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

      // Volume histogram
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      const volumeData = candleData.map((c) => ({
        time: (Math.floor(c.timestamp / 1000)) as import("lightweight-charts").UTCTimestamp,
        value: c.volume ?? 0,
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
      seriesRef.current = series as unknown as ISeriesApi<"Candlestick">;

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
    }

    chart.timeScale().fitContent();
  }, [chartType, candleData, lineData, priceUsd]);

  // Update mark price line when live price changes
  useEffect(() => {
    if (priceLineRef.current && seriesRef.current && priceUsd != null) {
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
        heightClass="h-[200px] sm:h-[400px]"
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

          <div className="flex gap-1 rounded-none border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
            {(["1m", "5m", "1h", "4h", "1d", "7d", "30d"] as Timeframe[]).map((tf) => (
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

      {/* Chart container — lightweight-charts renders here.
          GH#1625/GH#1628: explicit height required so autoSize has a non-zero
          container to fill. flex-1 alone gives 0 height when parent is not flex. */}
      <div ref={containerRef} className="w-full h-[300px] lg:h-[500px]" />
    </div>
  );
};
