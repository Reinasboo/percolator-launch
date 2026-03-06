"use client";

import { useEffect, useState, useRef } from "react";

export type PriceSourceType = "pyth" | "dex" | "jupiter";

export interface PriceSource {
  type: PriceSourceType;
  address: string;
  dexId?: string;
  pairLabel?: string;
  liquidity: number;
  price: number;
  confidence: number;
}

export interface PriceRouterState {
  bestSource: PriceSource | null;
  allSources: PriceSource[];
  loading: boolean;
  error: string | null;
}

// Use Next.js API route: /api/oracle/resolve/[ca] (Next.js handles proxy/cache)
const API_BASE = "/api";

/** Maximum number of retry attempts for transient errors */
const MAX_RETRIES = 2;
/** Base delay (ms) for exponential backoff */
const BASE_DELAY_MS = 1_000;

/**
 * Auto-discover the best oracle source for a given token mint.
 * Queries the backend /oracle/resolve/:mint endpoint.
 *
 * PERC-233: On 404 (unknown token), returns immediately with error — no retries.
 * On transient errors (5xx, network), retries up to MAX_RETRIES with exponential backoff.
 */
export function usePriceRouter(mintAddress: string | null): PriceRouterState {
  const [state, setState] = useState<PriceRouterState>({
    bestSource: null,
    allSources: [],
    loading: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setState({ bestSource: null, allSources: [], loading: false, error: null });

    // Reject URLs and non-base58 inputs immediately — don't hit the API
    if (!mintAddress || mintAddress.length < 32) return;
    if (mintAddress.startsWith("http://") || mintAddress.startsWith("https://") || mintAddress.includes("://")) {
      setState({
        bestSource: null,
        allSources: [],
        loading: false,
        error: "Paste a valid Solana token address, not a URL",
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true }));

    (async () => {
      let lastError: string | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (controller.signal.aborted) return;

        // Exponential backoff on retries (0ms for first attempt)
        if (attempt > 0) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          if (controller.signal.aborted) return;
        }

        try {
          const resp = await fetch(`${API_BASE}/oracle/resolve/${mintAddress}`, {
            signal: controller.signal,
          });

          // 404 = unknown token — do NOT retry, show error immediately (PERC-233)
          if (resp.status === 404) {
            if (!controller.signal.aborted) {
              setState({
                bestSource: null,
                allSources: [],
                loading: false,
                error: "Unknown oracle — no price feed found for this token",
              });
            }
            return;
          }

          // 4xx client errors (other than 404) — do not retry
          if (resp.status >= 400 && resp.status < 500) {
            if (!controller.signal.aborted) {
              setState({
                bestSource: null,
                allSources: [],
                loading: false,
                error: `Oracle lookup failed (HTTP ${resp.status})`,
              });
            }
            return;
          }

          // 5xx — retry with backoff
          if (!resp.ok) {
            lastError = `HTTP ${resp.status}`;
            continue;
          }

          const data = await resp.json();

          // PERC-470: Map /api/oracle/resolve response shape to PriceSource
          // API returns { oracleMode, feedId, dexPoolAddress, dexType, price, source }
          // NOT { bestSource, allSources } — adapt here.
          let bestSource: PriceSource | null = null;
          if (data.oracleMode === "pyth" && data.feedId) {
            bestSource = {
              type: "pyth",
              address: data.feedId,
              pairLabel: data.symbol ?? null,
              liquidity: 0,
              price: data.price ?? 0,
              confidence: 1,
            };
          } else if (data.oracleMode === "hyperp" && data.dexPoolAddress) {
            bestSource = {
              type: "dex",
              address: data.dexPoolAddress,
              dexId: data.dexType ?? undefined,
              pairLabel: data.symbol ?? null,
              liquidity: 0,
              price: data.price ?? 0,
              confidence: 0.9,
            };
          } else if (data.oracleMode === "admin") {
            // No oracle found — bestSource stays null, wizard falls to admin mode
            bestSource = null;
          } else if (data.bestSource) {
            // Legacy shape fallback
            bestSource = data.bestSource;
          }

          if (!controller.signal.aborted) {
            setState({
              bestSource,
              allSources: data.allSources || (bestSource ? [bestSource] : []),
              loading: false,
              error: null,
            });
          }
          return; // success — exit retry loop
        } catch (err: any) {
          if (err.name === "AbortError") return;
          lastError = err.message || "Failed to resolve oracle";
          // Network error — continue to retry
        }
      }

      // All retries exhausted
      if (!controller.signal.aborted) {
        setState({
          bestSource: null,
          allSources: [],
          loading: false,
          error: lastError || "Failed to resolve oracle after retries",
        });
      }
    })();

    return () => controller.abort();
  }, [mintAddress]);

  return state;
}
