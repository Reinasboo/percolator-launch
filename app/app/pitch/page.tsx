"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Slide Data ──────────────────────────────────────────────────────────────

const TOTAL_SLIDES = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SlideProps {
  isCurrent: boolean;
}

// ─── Individual Slides ───────────────────────────────────────────────────────

function Slide01Cover({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner pitch-center">
        <div className="pitch-overline">Seed Round</div>
        <h1 className="pitch-hero-title">Percolator</h1>
        <p className="pitch-hero-sub">
          Permissionless perpetual futures.<br />
          Any token. Any market. No gatekeepers.
        </p>
        <div className="pitch-divider" />
        <div className="pitch-meta-row">
          <span className="pitch-tag">Solana</span>
          <span className="pitch-tag">Devnet Live</span>
          <span className="pitch-tag">Apache 2.0</span>
        </div>
        <p className="pitch-url">percolatorlaunch.com</p>
      </div>
      {/* Background grid */}
      <div className="pitch-bg-grid" aria-hidden />
    </div>
  );
}

function Slide02Problem({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">01 / Problem</div>
        <h2 className="pitch-title">The perp market is broken for new tokens</h2>
        <div className="pitch-problem-grid">
          <div className="pitch-problem-card">
            <div className="pitch-problem-stat">$19–25M</div>
            <p>Cost to create a market on Hyperliquid via competitive auction. Jupiter and Drift require team approval.</p>
          </div>
          <div className="pitch-problem-card">
            <div className="pitch-problem-stat">15M+</div>
            <p>Tokens on pump.fun and Solana DEXes with zero perp market access — no Pyth oracle, no market.</p>
          </div>
          <div className="pitch-problem-card">
            <div className="pitch-problem-stat">ADL</div>
            <p>Auto-deleveraging queues pick winners and losers arbitrarily during liquidation cascades. No fair mechanism exists.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide03Solution({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">02 / Solution</div>
        <h2 className="pitch-title">Three innovations that unlock permissionless perps</h2>
        <div className="pitch-solution-stack">
          <div className="pitch-solution-item">
            <div className="pitch-solution-num purple">01</div>
            <div>
              <div className="pitch-solution-name">HYPERP Oracle</div>
              <p className="pitch-solution-desc">Fully on-chain price oracle derived from Raydium and Meteora pool state. Any token with a DEX pool gets an oracle from block one. No Pyth dependency.</p>
            </div>
          </div>
          <div className="pitch-solution-item">
            <div className="pitch-solution-num cyan">02</div>
            <div>
              <div className="pitch-solution-name">H + A/K Risk Engine</div>
              <p className="pitch-solution-desc">Mathematically fair settlement replacing ADL. Proportional haircuts, O(1) per-account settlement, no queue, no priority advantage.</p>
            </div>
          </div>
          <div className="pitch-solution-item">
            <div className="pitch-solution-num purple">03</div>
            <div>
              <div className="pitch-solution-name">Permissionless Markets</div>
              <p className="pitch-solution-desc">Seed a vault, set a fee rate, market is live. $500 minimum deposit. No application. No approval.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide04HowItWorks({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">03 / How It Works</div>
        <h2 className="pitch-title">From vault seed to live market in seconds</h2>
        <div className="pitch-flow-row">
          <div className="pitch-flow-step">
            <div className="pitch-flow-icon">🏦</div>
            <div className="pitch-flow-step-title">Creator Seeds Vault</div>
            <p>Deposit USDC, set trading fee 1–10%. Market activates immediately on-chain.</p>
          </div>
          <div className="pitch-flow-arrow">→</div>
          <div className="pitch-flow-step">
            <div className="pitch-flow-icon">📡</div>
            <div className="pitch-flow-step-title">HYPERP Sources Price</div>
            <p>Mark price sourced from on-chain pool accounts. No external oracle required.</p>
          </div>
          <div className="pitch-flow-arrow">→</div>
          <div className="pitch-flow-step">
            <div className="pitch-flow-icon">📈</div>
            <div className="pitch-flow-step-title">Traders Open Positions</div>
            <p>Leveraged longs and shorts against the vault. All on-chain, permissionless.</p>
          </div>
          <div className="pitch-flow-arrow">→</div>
          <div className="pitch-flow-step">
            <div className="pitch-flow-icon">💸</div>
            <div className="pitch-flow-step-title">Creator Earns Fees</div>
            <p>Fee share distributed automatically on-chain. Every trade, every block.</p>
          </div>
        </div>
        <div className="pitch-note">
          <span className="pitch-note-label">$500 min deposit</span>
          <span className="pitch-note-sep">·</span>
          <span className="pitch-note-label">No application</span>
          <span className="pitch-note-sep">·</span>
          <span className="pitch-note-label">No approval</span>
          <span className="pitch-note-sep">·</span>
          <span className="pitch-note-label">Fully on-chain</span>
        </div>
      </div>
    </div>
  );
}

function Slide05HYPERP({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">04 / HYPERP Pricing Engine</div>
        <h2 className="pitch-title">The first fully on-chain Solana perp oracle</h2>
        <div className="pitch-two-col">
          <div className="pitch-tech-details">
            <div className="pitch-tech-item">
              <div className="pitch-tech-label">Source</div>
              <div className="pitch-tech-value">Raydium CLMM + Meteora DLMM pool accounts read directly in-program</div>
            </div>
            <div className="pitch-tech-item">
              <div className="pitch-tech-label">Coverage</div>
              <div className="pitch-tech-value">Any token with a live DEX pool — from block one of listing</div>
            </div>
            <div className="pitch-tech-item">
              <div className="pitch-tech-label">Accuracy</div>
              <div className="pitch-tech-value mono">&lt;0.05% deviation tested on BTC, SOL, ETH</div>
            </div>
            <div className="pitch-tech-item">
              <div className="pitch-tech-label">Dependency</div>
              <div className="pitch-tech-value">Zero — no Pyth, no Chainlink, no external CPI required</div>
            </div>
          </div>
          <div className="pitch-highlight-box">
            <div className="pitch-highlight-header purple">Why It Matters</div>
            <p>Existing protocols require Pyth price coverage before a market can exist. HYPERP eliminates that dependency entirely — if a token trades on a Solana DEX, it can have a perp market on Percolator.</p>
            <div className="pitch-highlight-stat">
              <span className="mono">15M+</span>
              <span>tokens now eligible for perp markets</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide06HAK({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">05 / H + A/K Risk Engine</div>
        <h2 className="pitch-title">Mathematically fair settlement — no queue, no ADL</h2>
        <div className="pitch-two-col">
          <div>
            <p className="pitch-body-text">
              H is a global haircut ratio applied to profit extraction when the vault is stressed.
              Every profitable account sees the same fraction — no queue, no first-mover advantage,
              no arbitrary counterparty selection.
            </p>
            <p className="pitch-body-text" style={{ marginTop: '1rem' }}>
              A/K replaces per-account ADL with two global coefficients that socialise position
              reduction and deficit absorption across the entire side in O(1) per account.
            </p>
            <div className="pitch-external-validation">
              <div className="pitch-ev-label">External Validation</div>
              <p>Toly (Solana co-founder) is building independently on the same H + A/K design.</p>
            </div>
          </div>
          <div className="pitch-formula-block">
            <div className="pitch-formula-title">Settlement Formulas</div>
            <div className="pitch-formula">
              <div className="pitch-formula-label">Vault Residual</div>
              <div className="pitch-formula-code">Residual = max(0, V − C_tot − I)</div>
            </div>
            <div className="pitch-formula">
              <div className="pitch-formula-label">Haircut Ratio</div>
              <div className="pitch-formula-code">h = min(Residual, PNL_matured_pos_tot)<br />    / PNL_matured_pos_tot</div>
            </div>
            <div className="pitch-formula-note">
              O(1) per account · no priority advantage · fully on-chain
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide07FormalVerification({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">06 / Formal Verification</div>
        <h2 className="pitch-title">Proved correct — not just tested</h2>
        <div className="pitch-verification-layout">
          <div className="pitch-kani-block">
            <div className="pitch-kani-header">
              <span className="pitch-kani-badge">Kani</span>
              <span className="pitch-kani-desc">Formal model checker for Rust — proves properties hold across every possible program input</span>
            </div>
            <div className="pitch-proofs-grid">
              <div className="pitch-proof-item">
                <div className="pitch-proof-num mono">516</div>
                <div className="pitch-proof-label">Proofs verified</div>
              </div>
              <div className="pitch-proof-item">
                <div className="pitch-proof-num mono green">0</div>
                <div className="pitch-proof-label">Critical findings</div>
              </div>
              <div className="pitch-proof-item">
                <div className="pitch-proof-num mono green">0</div>
                <div className="pitch-proof-label">High findings</div>
              </div>
            </div>
          </div>
          <div className="pitch-proof-categories">
            <div className="pitch-proof-cat">
              <div className="pitch-proof-cat-dot purple" />
              <span>Liquidation invariants</span>
            </div>
            <div className="pitch-proof-cat">
              <div className="pitch-proof-cat-dot purple" />
              <span>Fee split correctness</span>
            </div>
            <div className="pitch-proof-cat">
              <div className="pitch-proof-cat-dot purple" />
              <span>Funding zero-sum property</span>
            </div>
            <div className="pitch-proof-cat">
              <div className="pitch-proof-cat-dot purple" />
              <span>Conservation properties</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function Slide08Traction({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">07 / Traction</div>
        <h2 className="pitch-title">Live on devnet. Organic adoption.</h2>
        <div className="pitch-traction-grid">
          <div className="pitch-traction-card">
            <div className="pitch-traction-num mono">168</div>
            <div className="pitch-traction-label">Devnet markets created</div>
          </div>
          <div className="pitch-traction-card">
            <div className="pitch-traction-num mono">2,700+</div>
            <div className="pitch-traction-label">X followers, entirely organic</div>
          </div>
          <div className="pitch-traction-card">
            <div className="pitch-traction-num mono">18×</div>
            <div className="pitch-traction-label">Cheaper token instructions via pinocchio-token (SIMD-0266)</div>
          </div>
          <div className="pitch-traction-card">
            <div className="pitch-traction-num mono">Apache 2.0</div>
            <div className="pitch-traction-label">Fully open source — 8 public repos</div>
          </div>
        </div>
        <div className="pitch-traction-milestones">
          <div className="pitch-milestone">
            <div className="pitch-milestone-dot cyan" />
            <span>Position NFTs live — transferable perp positions via SPL Token-2022, first on Solana</span>
          </div>
          <div className="pitch-milestone">
            <div className="pitch-milestone-dot cyan" />
            <span>pinocchio-token migration complete — 18× cheaper when SIMD-0266 activates April 2026</span>
          </div>
          <div className="pitch-milestone">
            <div className="pitch-milestone-dot purple" />
            <span>Toly (Solana co-founder) independently building on H + A/K design</span>
          </div>
          <div className="pitch-milestone">
            <div className="pitch-milestone-dot purple" />
            <span>8 public repos, Apache 2.0 — fully open source</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide09Market({ isCurrent }: SlideProps) {
  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">08 / Market Opportunity</div>
        <h2 className="pitch-title">$2–4B/month — only blue chips. We unlock the long tail.</h2>
        <div className="pitch-market-layout">
          <div className="pitch-market-stat-block">
            <div className="pitch-market-big-num mono">$2–4B</div>
            <div className="pitch-market-big-label">Monthly Solana perp volume</div>
            <div className="pitch-market-sub">Entirely in blue-chip tokens today</div>
          </div>
          <div className="pitch-market-divider" />
          <div className="pitch-market-opportunity">
            <div className="pitch-market-opp-num mono">15M+</div>
            <div className="pitch-market-opp-label">Tokens with zero perp market access</div>
            <p className="pitch-market-opp-desc">
              Every token launched on pump.fun or a Solana DEX is a potential market creator on Percolator.
              The addressable market isn't the blue-chip volume — it's every token that has never had a perp market.
            </p>
            <div className="pitch-market-callout">
              Percolator opens perpetual futures to the entire long tail of Solana tokens
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide10Roadmap({ isCurrent }: SlideProps) {
  const phases = [
    {
      phase: "Now",
      status: "live",
      title: "Devnet Live",
      items: ["168 markets active", "191 organic users", "HYPERP oracle deployed", "H + A/K engine verified"],
    },
    {
      phase: "Apr 2026",
      status: "next",
      title: "Mainnet Beta",
      items: ["Mainnet beta launch", "Initial markets live", "Creator fee share"],
    },
    {
      phase: "Q3 2026",
      status: "planned",
      title: "Ecosystem Integration",
      items: ["Ecosystem integrations", "Liquidity programs", "Mobile app"],
    },
    {
      phase: "2027",
      status: "future",
      title: "Scale",
      items: ["Cross-chain expansion", "Institutional API"],
    },
  ];

  return (
    <div className="pitch-slide">
      <div className="pitch-slide-inner">
        <div className="pitch-label">09 / Roadmap</div>
        <h2 className="pitch-title">Devnet → Mainnet → Ecosystem</h2>
        <div className="pitch-roadmap-row">
          {phases.map((p, i) => (
            <div key={i} className={`pitch-roadmap-phase pitch-roadmap-${p.status}`}>
              <div className="pitch-roadmap-phase-label">{p.phase}</div>
              <div className="pitch-roadmap-phase-title">{p.title}</div>
              <ul className="pitch-roadmap-items">
                {p.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Slide Registry ───────────────────────────────────────────────────────────

const SLIDES = [
  { id: 1, title: "Cover", component: Slide01Cover },
  { id: 2, title: "Problem", component: Slide02Problem },
  { id: 3, title: "Solution", component: Slide03Solution },
  { id: 4, title: "How It Works", component: Slide04HowItWorks },
  { id: 5, title: "HYPERP", component: Slide05HYPERP },
  { id: 6, title: "H + A/K", component: Slide06HAK },
  { id: 7, title: "Formal Verification", component: Slide07FormalVerification },
  { id: 8, title: "Traction", component: Slide08Traction },
  { id: 9, title: "Market Opportunity", component: Slide09Market },
  { id: 10, title: "Roadmap", component: Slide10Roadmap },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PitchPage() {
  const [current, setCurrent] = useState(0);

  const prev = useCallback(() => {
    setCurrent((c) => Math.max(0, c - 1));
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => Math.min(TOTAL_SLIDES - 1, c + 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const SlideComponent = SLIDES[current].component;

  return (
    <>
      {/* Full-screen overlay covering Header/Footer */}
      <div
        className="pitch-deck-overlay"
        onClick={next}
        role="presentation"
      >
        {/* Slide content */}
        <SlideComponent isCurrent />

        {/* Controls bar */}
        <div
          className="pitch-controls"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="pitch-nav-btn"
            onClick={prev}
            disabled={current === 0}
            aria-label="Previous slide"
          >
            ←
          </button>
          <span className="pitch-counter mono">
            {current + 1} / {TOTAL_SLIDES}
          </span>
          <button
            className="pitch-nav-btn"
            onClick={next}
            disabled={current === TOTAL_SLIDES - 1}
            aria-label="Next slide"
          >
            →
          </button>
        </div>

        {/* Slide dots */}
        <div
          className="pitch-dots"
          onClick={(e) => e.stopPropagation()}
        >
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`pitch-dot ${i === current ? "pitch-dot-active" : ""}`}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Styles */}
      <style>{`
        /* ── Full-screen overlay ── */
        .pitch-deck-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #0D0D0F;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          overflow: hidden;
        }

        /* ── Slide base ── */
        .pitch-slide {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 0 0 80px 0;
        }

        .pitch-slide-inner {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem 2.5rem;
        }

        .pitch-center {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── Background grid ── */
        .pitch-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(153,69,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(153,69,255,0.04) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
        }

        /* ── Typography ── */
        .pitch-overline {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #9945FF;
          margin-bottom: 1.5rem;
        }

        .pitch-hero-title {
          font-family: 'Inter Tight', 'Inter', sans-serif;
          font-size: clamp(3.5rem, 8vw, 7rem);
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1;
          background: linear-gradient(135deg, #fff 0%, #9945FF 50%, #22D3EE 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 1.5rem;
        }

        .pitch-hero-sub {
          font-family: 'Inter', sans-serif;
          font-size: clamp(1.1rem, 2.5vw, 1.5rem);
          color: rgba(255,255,255,0.65);
          line-height: 1.6;
          max-width: 600px;
          margin-bottom: 2rem;
        }

        .pitch-divider {
          width: 80px;
          height: 1px;
          background: linear-gradient(90deg, #9945FF, #22D3EE);
          margin: 0 auto 2rem;
        }

        .pitch-meta-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .pitch-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.35rem 0.85rem;
          border-radius: 4px;
          border: 1px solid rgba(153,69,255,0.35);
          color: rgba(153,69,255,0.9);
          background: rgba(153,69,255,0.06);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .pitch-url {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
          color: rgba(34,211,238,0.6);
          letter-spacing: 0.05em;
        }

        .pitch-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(153,69,255,0.7);
          margin-bottom: 1.2rem;
        }

        .pitch-title {
          font-family: 'Inter Tight', 'Inter', sans-serif;
          font-size: clamp(1.6rem, 3.5vw, 2.8rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: #fff;
          margin-bottom: 2rem;
        }

        /* ── Problem slide ── */
        .pitch-problem-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .pitch-problem-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 1.75rem;
        }

        .pitch-problem-card:hover {
          border-color: rgba(153,69,255,0.25);
        }

        .pitch-problem-stat {
          font-family: 'JetBrains Mono', monospace;
          font-size: clamp(1.8rem, 3vw, 2.5rem);
          font-weight: 700;
          color: #FF3B5C;
          margin-bottom: 0.75rem;
        }

        .pitch-problem-card p {
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.55);
        }

        /* ── Solution slide ── */
        .pitch-solution-stack {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .pitch-solution-item {
          display: flex;
          gap: 1.5rem;
          align-items: flex-start;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 1.25rem 1.5rem;
        }

        .pitch-solution-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 1.8rem;
          font-weight: 700;
          flex-shrink: 0;
          line-height: 1;
          padding-top: 0.1rem;
        }

        .pitch-solution-num.purple { color: #9945FF; }
        .pitch-solution-num.cyan { color: #22D3EE; }

        .pitch-solution-name {
          font-family: 'Inter Tight', 'Inter', sans-serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.4rem;
        }

        .pitch-solution-desc {
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.55);
        }

        /* ── How It Works ── */
        .pitch-flow-row {
          display: flex;
          align-items: flex-start;
          gap: 0;
          margin-bottom: 2rem;
        }

        .pitch-flow-step {
          flex: 1;
          text-align: center;
          padding: 1.5rem 1rem;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
        }

        .pitch-flow-arrow {
          align-self: center;
          color: rgba(153,69,255,0.5);
          font-size: 1.5rem;
          padding: 0 0.5rem;
          flex-shrink: 0;
        }

        .pitch-flow-icon {
          font-size: 2rem;
          margin-bottom: 0.75rem;
        }

        .pitch-flow-step-title {
          font-family: 'Inter Tight', 'Inter', sans-serif;
          font-weight: 700;
          font-size: 0.95rem;
          color: #fff;
          margin-bottom: 0.5rem;
        }

        .pitch-flow-step p {
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          line-height: 1.55;
          color: rgba(255,255,255,0.5);
        }

        .pitch-note {
          display: flex;
          gap: 1rem;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
        }

        .pitch-note-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          color: rgba(34,211,238,0.7);
          letter-spacing: 0.08em;
        }

        .pitch-note-sep {
          color: rgba(255,255,255,0.2);
        }

        /* ── Two-column layout ── */
        .pitch-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        /* ── HYPERP slide ── */
        .pitch-tech-details {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .pitch-tech-item {
          border-left: 2px solid rgba(153,69,255,0.4);
          padding-left: 1rem;
        }

        .pitch-tech-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(153,69,255,0.7);
          margin-bottom: 0.25rem;
        }

        .pitch-tech-value {
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.7);
          line-height: 1.5;
        }

        .pitch-tech-value.mono,
        .mono {
          font-family: 'JetBrains Mono', monospace;
        }

        .pitch-highlight-box {
          background: rgba(153,69,255,0.05);
          border: 1px solid rgba(153,69,255,0.2);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .pitch-highlight-header {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 0.75rem;
        }

        .pitch-highlight-header.purple { color: #9945FF; }
        .pitch-highlight-header.cyan { color: #22D3EE; }

        .pitch-highlight-box p {
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          line-height: 1.65;
          color: rgba(255,255,255,0.6);
          margin-bottom: 1rem;
        }

        .pitch-highlight-stat {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
        }

        .pitch-highlight-stat .mono {
          font-size: 2rem;
          font-weight: 700;
          color: #22D3EE;
        }

        .pitch-highlight-stat span:last-child {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
        }

        /* ── H + A/K slide ── */
        .pitch-body-text {
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem;
          line-height: 1.7;
          color: rgba(255,255,255,0.6);
        }

        .pitch-external-validation {
          margin-top: 1.5rem;
          padding: 1rem 1.25rem;
          background: rgba(34,211,238,0.05);
          border: 1px solid rgba(34,211,238,0.2);
          border-radius: 8px;
        }

        .pitch-ev-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #22D3EE;
          margin-bottom: 0.4rem;
        }

        .pitch-external-validation p {
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
        }

        .pitch-formula-block {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(153,69,255,0.25);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .pitch-formula-title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(153,69,255,0.7);
          margin-bottom: 1.25rem;
        }

        .pitch-formula {
          margin-bottom: 1.25rem;
        }

        .pitch-formula-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.35);
          margin-bottom: 0.4rem;
          letter-spacing: 0.08em;
        }

        .pitch-formula-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          font-weight: 700;
          color: #22D3EE;
          background: rgba(34,211,238,0.05);
          border-radius: 6px;
          padding: 0.6rem 0.85rem;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .pitch-formula-note {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.08em;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        /* ── Formal Verification ── */
        .pitch-verification-layout {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .pitch-kani-block {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .pitch-kani-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .pitch-kani-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.3rem 0.75rem;
          background: rgba(153,69,255,0.15);
          border: 1px solid rgba(153,69,255,0.4);
          border-radius: 6px;
          color: #9945FF;
          letter-spacing: 0.1em;
        }

        .pitch-kani-desc {
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.5);
        }

        .pitch-proofs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .pitch-proof-item {
          text-align: center;
        }

        .pitch-proof-num {
          font-size: 2.5rem;
          font-weight: 700;
          color: #fff;
        }

        .pitch-proof-num.green { color: #14F195; }

        .pitch-proof-label {
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.4);
          margin-top: 0.25rem;
        }

        .pitch-proof-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 2rem;
        }

        .pitch-proof-cat {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.55);
        }

        .pitch-proof-cat-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .pitch-proof-cat-dot.purple { background: #9945FF; }
        .pitch-proof-cat-dot.cyan { background: #22D3EE; }

        /* ── Traction ── */
        .pitch-traction-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .pitch-traction-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 1.25rem;
          text-align: center;
        }

        .pitch-traction-num {
          font-size: clamp(1.6rem, 2.5vw, 2.2rem);
          font-weight: 700;
          color: #9945FF;
          margin-bottom: 0.4rem;
        }

        .pitch-traction-label {
          font-family: 'Inter', sans-serif;
          font-size: 0.78rem;
          color: rgba(255,255,255,0.45);
          line-height: 1.4;
        }

        .pitch-traction-milestones {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .pitch-milestone {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.55);
        }

        .pitch-milestone-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .pitch-milestone-dot.cyan { background: #22D3EE; }
        .pitch-milestone-dot.purple { background: #9945FF; }

        /* ── Market Opportunity ── */
        .pitch-market-layout {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 2rem;
          align-items: center;
        }

        .pitch-market-stat-block { text-align: center; }

        .pitch-market-big-num {
          font-size: clamp(3rem, 5vw, 5rem);
          font-weight: 700;
          color: #9945FF;
          line-height: 1;
          margin-bottom: 0.5rem;
        }

        .pitch-market-big-label {
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          margin-bottom: 0.4rem;
        }

        .pitch-market-sub {
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.35);
        }

        .pitch-market-divider {
          width: 1px;
          height: 180px;
          background: linear-gradient(to bottom, transparent, rgba(153,69,255,0.4), transparent);
        }

        .pitch-market-opportunity { text-align: center; }

        .pitch-market-opp-num {
          font-size: clamp(3rem, 5vw, 5rem);
          font-weight: 700;
          color: #22D3EE;
          line-height: 1;
          margin-bottom: 0.5rem;
        }

        .pitch-market-opp-label {
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          margin-bottom: 0.75rem;
        }

        .pitch-market-opp-desc {
          font-family: 'Inter', sans-serif;
          font-size: 0.85rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.45);
          margin-bottom: 1rem;
        }

        .pitch-market-callout {
          font-family: 'Inter Tight', 'Inter', sans-serif;
          font-size: 0.875rem;
          font-weight: 700;
          color: #22D3EE;
          padding: 0.6rem 1rem;
          border: 1px solid rgba(34,211,238,0.25);
          border-radius: 6px;
          background: rgba(34,211,238,0.04);
        }

        /* ── Roadmap ── */
        .pitch-roadmap-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        .pitch-roadmap-phase {
          border-radius: 10px;
          padding: 1.25rem;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.025);
        }

        .pitch-roadmap-live {
          border-color: rgba(34,211,238,0.3);
          background: rgba(34,211,238,0.04);
        }

        .pitch-roadmap-next {
          border-color: rgba(153,69,255,0.3);
          background: rgba(153,69,255,0.04);
        }

        .pitch-roadmap-phase-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          margin-bottom: 0.4rem;
        }

        .pitch-roadmap-live .pitch-roadmap-phase-label { color: #22D3EE; }
        .pitch-roadmap-next .pitch-roadmap-phase-label { color: #9945FF; }

        .pitch-roadmap-phase-title {
          font-family: 'Inter Tight', 'Inter', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.75rem;
        }

        .pitch-roadmap-items {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .pitch-roadmap-items li {
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
          padding-left: 0.75rem;
          position: relative;
        }

        .pitch-roadmap-items li::before {
          content: '·';
          position: absolute;
          left: 0;
          color: rgba(255,255,255,0.25);
        }

        /* ── Controls ── */
        .pitch-controls {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 1rem;
          z-index: 10;
        }

        .pitch-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.7);
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .pitch-nav-btn:hover:not(:disabled) {
          border-color: rgba(153,69,255,0.5);
          background: rgba(153,69,255,0.12);
          color: #fff;
        }

        .pitch-nav-btn:disabled {
          opacity: 0.25;
          cursor: default;
        }

        .pitch-counter {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.4);
          min-width: 50px;
          text-align: center;
        }

        /* ── Slide dots ── */
        .pitch-dots {
          position: absolute;
          bottom: 66px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
          z-index: 10;
        }

        .pitch-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.18);
          border: none;
          cursor: pointer;
          padding: 0;
          transition: all 0.2s ease;
        }

        .pitch-dot-active {
          background: #9945FF;
          width: 20px;
          border-radius: 3px;
        }

        /* ─── PRINT STYLES ─── */
        @media print {
          .pitch-deck-overlay {
            position: static;
            display: block;
          }

          .pitch-controls,
          .pitch-dots {
            display: none !important;
          }

          .pitch-slide {
            page-break-after: always;
            break-after: page;
            height: 100vh;
            min-height: 100vh;
            padding: 0;
          }
        }

        /* ─── Mobile ─── */
        @media (max-width: 768px) {
          .pitch-slide-inner {
            padding: 1.25rem 1rem;
          }

          .pitch-problem-grid,
          .pitch-traction-grid,
          .pitch-roadmap-row {
            grid-template-columns: repeat(2, 1fr);
          }

          .pitch-two-col {
            grid-template-columns: 1fr;
          }

          .pitch-market-layout {
            grid-template-columns: 1fr;
          }

          .pitch-market-divider {
            width: 80px;
            height: 1px;
            margin: 0 auto;
          }

          .pitch-flow-row {
            flex-direction: column;
            gap: 0.5rem;
          }

          .pitch-flow-arrow {
            transform: rotate(90deg);
            align-self: center;
          }
        }

        @media (max-width: 480px) {
          .pitch-problem-grid,
          .pitch-traction-grid,
          .pitch-roadmap-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
