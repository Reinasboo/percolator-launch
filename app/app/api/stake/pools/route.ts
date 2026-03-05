import { NextResponse } from "next/server";

export interface StakePoolData {
  id: string;
  symbol: string;
  token: string;
  tvl_usd: number;
  apr_pct: number;
  cap_usd: number;
  deposited_usd: number;
  cooldown_slots: number;
}

const POOLS: StakePoolData[] = [
  {
    id: "sol-perp-pool",
    symbol: "SOL-PERP-POOL",
    token: "SOL",
    tvl_usd: 50_000_000,
    apr_pct: 12.4,
    cap_usd: 5_000_000,
    deposited_usd: 4_250_000,
    cooldown_slots: 3200,
  },
  {
    id: "btc-perp-pool",
    symbol: "BTC-PERP-POOL",
    token: "BTC",
    tvl_usd: 12_300_000,
    apr_pct: 9.2,
    cap_usd: 10_000_000,
    deposited_usd: 2_300_000,
    cooldown_slots: 3200,
  },
  {
    id: "eth-perp-pool",
    symbol: "ETH-PERP-POOL",
    token: "ETH",
    tvl_usd: 8_100_000,
    apr_pct: 7.8,
    cap_usd: 10_000_000,
    deposited_usd: 6_100_000,
    cooldown_slots: 3200,
  },
];

export async function GET() {
  const total_staked_usd = POOLS.reduce((s, p) => s + p.tvl_usd, 0);
  const active_pools = POOLS.length;
  const avg_apr_pct =
    POOLS.length > 0
      ? POOLS.reduce((s, p) => s + p.apr_pct, 0) / POOLS.length
      : 0;

  return NextResponse.json({
    pools: POOLS,
    total_staked_usd,
    active_pools,
    avg_apr_pct: Math.round(avg_apr_pct * 10) / 10,
  });
}
