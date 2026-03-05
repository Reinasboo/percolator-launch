"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ShimmerSkeleton } from "@/components/ui/ShimmerSkeleton";

interface StakeHeroProps {
  totalStaked: number;
  yourDeposits: number;
  activePools: number;
  avgApr: number;
  loading: boolean;
}

export function StakeHero({ totalStaked, yourDeposits, activePools, avgApr, loading }: StakeHeroProps) {
  const metrics = [
    { label: "Total Staked", value: totalStaked, prefix: "$", decimals: 0, color: "text-[var(--accent)]" },
    { label: "Your Deposits", value: yourDeposits, prefix: "$", decimals: 2, color: "text-[var(--text-secondary)]" },
    { label: "Active Pools", value: activePools, prefix: "", decimals: 0, color: "text-[var(--accent)]" },
    { label: "Avg APR", value: avgApr, prefix: "", suffix: "%", decimals: 1, color: "text-[var(--cyan)]" },
  ];

  return (
    <section className="relative overflow-hidden py-12 lg:py-16">
      <ScrollReveal>
        <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--text-secondary)]">
          // INSURANCE LP
        </p>
        <h1
          className="mb-4 text-4xl font-medium tracking-[-0.02em] sm:text-5xl lg:text-[56px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <span className="text-[var(--text)]">Stake. Earn.</span>
          <br />
          <span className="text-[var(--cyan)]">Back the Fund.</span>
        </h1>
        <p className="mb-8 max-w-[520px] text-base leading-[1.6] text-[var(--text-secondary)]">
          Deposit collateral into insurance pools to earn LP rewards and back the Percolator insurance fund.
        </p>

        <div className="mb-10 flex flex-wrap items-center gap-3">
          <a
            href="#deposit"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Deposit Now
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </a>
          <a
            href="/guide"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--cyan)]/40 px-6 py-3 text-sm font-medium text-[var(--cyan)] transition-colors hover:border-[var(--cyan)]/70 hover:bg-[var(--cyan)]/[0.06]"
          >
            Learn More
          </a>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--border)] bg-[var(--border)] md:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-[var(--panel-bg)] p-4 sm:p-5 transition-colors duration-200 hover:bg-[var(--bg-elevated)]">
              <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">{m.label}</p>
              {loading ? (
                <ShimmerSkeleton className="h-6 w-24" />
              ) : (
                <span className={`text-lg sm:text-xl font-semibold tracking-tight ${m.color}`} style={{ fontFamily: "var(--font-heading)" }}>
                  <AnimatedNumber value={m.value} prefix={m.prefix} suffix={m.suffix} decimals={m.decimals} />
                </span>
              )}
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
