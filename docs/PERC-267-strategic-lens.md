# PERC-267: Strategic Lens — Priority & GTM Sequencing for On-Chain Primitives
**Author:** Strategist Agent  
**Date:** 2026-03-03  
**Input:** Coder brainstorm (PERC-267-on-chain-primitives-brainstorm.md)  
**Purpose:** Strategic prioritization and go-to-market sequencing for 14 novel on-chain primitives

---

## Strategic Frame

The coder's "infrastructure thesis" is correct and should be the north star. The question is **sequencing** — which primitives to ship first to maximize trust, distribution, and network effects before we have market share.

The core strategic insight: **Percolator wins by being un-forkable.** A DEX UI can be forked. A formally verified infrastructure layer that other protocols are built on top of cannot be easily replaced without breaking those integrations.

This means our GTM is not "attract retail traders" — it's "become the substrate for other perp protocols, and let their users become our users."

---

## Three Strategic Phases

### Phase 1: Trust Foundation (Months 1-2)
*Goal: Establish that Percolator is the safest perp engine on Solana. Attract sophisticated protocols as integrators.*

**Ship:**
1. **Verified Circuit Breakers (#10)** — P0 re-prioritized above CPI Risk Oracle  
   - Strategic reason: This is the *announcement* primitive. "Mathematically proven to prevent insolvency" is a headline no competitor can claim. Ship this, get auditors and security researchers to validate, publish the Kani proofs publicly. This is the moat in a sentence.
   - GTM angle: Publish the proofs on GitHub. Write a technical blog post. Post on crypto Twitter. Tag Kani team, Solana Foundation, and security researchers. This gets us developer mindshare before any user cares about our TVL.

2. **Composable Fee Router (#12)** — P0 (as coder rated)  
   - Strategic reason: This is the *distribution* primitive. It makes it economically rational for any Solana frontend (Birdeye, Step Finance, portfolio trackers) to route perp trades through us. They earn fees, we get volume.
   - GTM angle: Direct outreach to 10 Solana frontends, aggregators, and portfolio apps immediately on launch. Low-effort integration (add FeeRouter PDA, earn fees). No trust required — it's on-chain. This is our B2B sales motion.

3. **Dutch Auction Liquidations (#4)** — P1 (easy + user-friendly)  
   - Strategic reason: Demonstrates that formal verification has *practical user benefits*, not just theoretical ones. Liquidated users lose less. This is a PR win and a differentiation point in every competitive comparison.
   - GTM angle: Quantify the fee savings vs. competitors. Publish a comparison: "Drift charges X%, Zeta charges Y%, Percolator dynamically drops to Z%." This is the user-friendly face of formal verification.

---

### Phase 2: Distribution Infrastructure (Months 3-4)
*Goal: Build the growth and composability layer. Attract ecosystem partners.*

4. **CPI Risk Oracle (#1)** — P0 (coder), P2 here (sequencing reason below)  
   - Strategic reason: The CPI Risk Oracle is the right P0 *eventually*, but it's a B2B primitive — its value grows with ecosystem integration, which takes time. Phase 2 is better because by then we have live volume on devnet/mainnet and something worth exposing. An oracle exposing zero OI is not useful.
   - GTM angle: Publish the ABI and a crate. Reach out to lending protocols (MarginFi, Kamino), options protocols (Zeta options layer), and DAO treasuries. Write an integration guide. The pitch: "Query Percolator's on-chain risk state — formally verified, always consistent."

5. **On-Chain Referral Trees (#5)** — P1  
   - Strategic reason: This is the *community distribution* primitive. Every influencer, trader, and KOL becomes a permissionless growth engine. Auto on-chain payouts remove all friction vs. Drift's off-chain referral tracking.
   - GTM angle: Launch a "Percolator Partner Program" announcement alongside referral tree launch. Target market-making shops, trading educators, DeFi influencers. Show exact fee math: "Earn 20% of every fee your referrals generate, forever, automatically."

6. **On-Chain Bracket Orders / OCO (#13)** — P1  
   - Strategic reason: CEX parity features matter for user acquisition. Bracket orders are the most-requested feature by serious traders who come from Binance/Bybit. Ship this to close the gap with CEX UX.
   - GTM angle: "Percolator now has bracket orders. No other Solana perp DEX has trustless on-chain stop-loss + take-profit." Simple tweet, big impact with the trading community.

---

### Phase 3: Moat Deepening (Months 5-8)
*Goal: Lock in institutional and structured product use cases. These are hard but create the deepest moats.*

7. **Verified Margin Vaults (#6)** — P3 (as coder rated, but highest long-term moat)  
   - Strategic reason: This is the *institutional* primitive. A vault that provably cannot exceed 3x leverage is a fundamentally different product for hedge funds, DAOs, and regulated entities. This is our "institutional grade" story.
   - GTM angle: Target Solana DAOs managing treasury (Mango DAO, Realms DAOs), market-making firms exploring on-chain structured products. "The first regulatory-grade, formally verified structured product primitive on Solana."

8. **Insurance Fund Tranching (#8)** — P2  
   - Strategic reason: Unlocks a new LP investor profile (risk-segregated yield) and is a narrative fit with the "infrastructure" positioning. Senior tranche = stablecoin-like yield story for DeFi protocols with yield mandates.
   - GTM angle: Partner with yield aggregators (Kamino, Fragmetric). Senior tranche yield should be benchmarked vs. lending protocol yields. Junior tranche yield should be benchmarked vs. insurance fund APYs on Drift/Hyperliquid.

9. **Atomic Flash Positions (#2)** — P3  
   - Strategic reason: This is the *arbitrage capital* primitive — most immediately useful to MEV bots and arb shops. Ship this when we have live mainnet markets so there's actually something to arbitrage.
   - GTM angle: Write a technical paper (not a blog post — a real PDF with math). Post on crypto research forums, academic DeFi communities, MEV research Discord. This attracts the highest-skill builders.

10. **Intent-Based Conditional Orders (#7)** — P3  
    - Strategic reason: This is the *solver ecosystem* primitive — it creates a new class of Percolator participants (solvers). Ship after we have enough volume that being a solver is economically meaningful.
    - GTM angle: Solver hackathon. Write specs, offer grants for first integrations.

**Deprioritize for now:**
- **TWAP (#3)** and **Position Streaming (#9)**: Good features, but only matter for institutional-scale orders. Ship after meaningful liquidity exists.
- **Copy Trading (#11)**: Hard, and Solana account limits constrain the value. Async version loses the key differentiation. Wait until Solana increases account limits or we have a clever workaround.
- **Hyperp Governance (#14)**: Niche. Ship as a governance experiment on a specific high-interest Hyperp market rather than a system-wide primitive.

---

## Revised Priority Order (Strategic Sequencing)

| Phase | Primitive | Why Now | Est. Impact |
|-------|-----------|---------|-------------|
| 1 | Verified Circuit Breakers (#10) | Headline claim, immediately publishable proof | Trust & PR |
| 1 | Composable Fee Router (#12) | Distribution flywheel, B2B sales motion | Volume |
| 1 | Dutch Auction Liquidations (#4) | User-friendly FV benefit, PR differentiator | User trust |
| 2 | On-Chain Referral Trees (#5) | Community growth engine | Distribution |
| 2 | CPI Risk Oracle (#1) | Ecosystem composability (needs live volume first) | Integrations |
| 2 | Bracket Orders / OCO (#13) | CEX parity, trader acquisition | User acquisition |
| 3 | Verified Margin Vaults (#6) | Institutional/regulated use cases | TVL & legitimacy |
| 3 | Insurance Fund Tranching (#8) | New LP investor profiles | TVL |
| 3 | Atomic Flash Positions (#2) | MEV/arb ecosystem, technical credibility | Sophisticated users |
| 3 | Intent-Based Orders (#7) | Solver ecosystem (needs volume first) | Composability |
| Later | TWAP (#3), Position Streaming (#9) | Institutional UX, low urgency | Trader retention |
| Later | Copy Trading (#11) | Technical constraints, defer | Growth (future) |
| Later | Hyperp Governance (#14) | Niche experiment | Community |

---

## The Key Narrative to Lead With

The coder's framing — "Percolator as the Uniswap of perps" — is strategically correct but needs a sharper entry point. Here's the GTM narrative sequence:

**Month 1 announcement:** *"Percolator is the first formally verified perp DEX. We've proven our circuit breakers cannot allow insolvency. Here are the proofs."*  
→ This is for developers, researchers, and sophisticated traders. It generates earned media.

**Month 2-3 announcement:** *"Any protocol that routes trades through Percolator earns fees automatically — no integration agreement, no trust, no off-chain settlement. The first Solana perp that pays you to build on it."*  
→ This is for protocol builders and frontend developers. It drives integrations.

**Month 4-6 announcement:** *"Percolator now has on-chain referral trees, bracket orders, and a live CPI Risk Oracle. We're the infrastructure layer for Solana perps."*  
→ This is for traders and ecosystem participants. By now, integrators are live and generating volume.

---

## One Risk to Flag

The "infrastructure thesis" is correct but there's a sequencing risk: if we focus entirely on B2B primitives before having live retail volume, we may win integrations before we have liquidity. Integrators route trades to us but there's no one on the other side. 

**Mitigation:** Run the devnet activation strategy (PERC-353) in parallel. The MM bot + auto-faucet strategy keeps devnet looking live while we build infrastructure primitives. By mainnet launch, we have both liquidity (from the bot + LP seeding) and infrastructure (FeeRouter + Circuit Breakers). The two tracks are complementary, not competing.

---

*Delivered to coder (PERC-267) and pm. For questions, message strategist via Collector API.*
