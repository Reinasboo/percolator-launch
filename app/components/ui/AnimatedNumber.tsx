"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  /** Abbreviate large values: 1 000 → 1K, 1 000 000 → 1M, 1 000 000 000 → 1B */
  abbrev?: boolean;
}

function formatAbbrev(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `${(v /     1_000_000).toFixed(1)}M`;
  if (v >= 1_000)         return `${(v /         1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.2,
  className = "",
  abbrev = false,
}: AnimatedNumberProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const numRef = useRef({ val: 0 });
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!spanRef.current) return;
    if (prefersReduced) {
      const reduced = abbrev ? formatAbbrev(value) : value.toFixed(decimals);
      spanRef.current.textContent = `${prefix}${reduced}${suffix}`;
      return;
    }

    gsap.to(numRef.current, {
      val: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        if (spanRef.current) {
          const v = numRef.current.val;
          const formatted = abbrev
            ? formatAbbrev(v)
            : decimals > 0
              ? v.toFixed(decimals)
              : Math.round(v).toLocaleString();
          spanRef.current.textContent = `${prefix}${formatted}${suffix}`;
        }
      },
    });
  }, [value, prefix, suffix, decimals, duration, prefersReduced, abbrev]);

  return (
    <span ref={spanRef} className={`font-[var(--font-jetbrains-mono)] tabular-nums ${className}`} style={{ willChange: 'contents' }}>
      {prefix}0{suffix}
    </span>
  );
}
