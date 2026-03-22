/**
 * HYPERP vs Pyth Accuracy Test — Mainnet Gate
 *
 * Compares HYPERP spot prices (from deepest Raydium/Meteora/DexScreener pools)
 * against Pyth mainnet oracle prices for SOL/USDC, BTC/USDC, ETH/USDC.
 *
 * Runs N samples at 60s intervals (default: 10 samples = ~10 min).
 * Pass criteria: max deviation <0.5%, average <0.25%.
 */

const SAMPLE_COUNT = parseInt(process.env.SAMPLES ?? "10");
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? "60000"); // 60s default

// Pyth mainnet price feed IDs (from https://pyth.network/developers/price-feed-ids)
const PYTH_IDS = {
  "SOL/USDC": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "BTC/USDC": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USDC": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};

// Token mints (mainnet)
// BTC: using cbBTC (3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh) — deepest BTC pool on Solana
// ETH: using Wormhole ETH (7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs)
// SOL: wrapped SOL (So111...)
const MINTS = {
  "SOL/USDC": "So11111111111111111111111111111111111111112",
  "BTC/USDC": "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",  // cbBTC (deepest on Solana)
  "ETH/USDC": "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",   // Wormhole ETH
};

// Pyth Hermes base URL — respects HERMES_URL env override (same as oracle-keeper.ts:64-66)
const HERMES_URL = process.env.HERMES_URL ?? "https://hermes.pyth.network";

// Canonical mainnet USDC mint — used to reliably filter quote tokens instead of symbol matching
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Minimum liquidity (USD) required for a DexScreener pool to be used as the price source.
// Pools below this threshold are considered stale/thin and we fall through to Jupiter price API.
// cbBTC's deepest Raydium pool was ~$0.4M and had a frozen price — well below 1M.
const MIN_DEX_LIQUIDITY_USD = 1_000_000;

// Known deepest mainnet pools per asset (Raydium/Meteora)
// These are used as hints for DexScreener lookup
const DEEP_POOLS = {
  "SOL/USDC": {
    raydium: "8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj", // SOL-USDC Raydium v4
    label: "Raydium SOL-USDC (8sLbNZ...)",
  },
  "BTC/USDC": {
    raydium: "6kbC5epG18DF2DwPEW34tBy5pGFS7pEGALR3v5MGxgc5", // BTC-USDC deepest
    label: "Raydium BTC-USDC (6kbC5e...)",
  },
  "ETH/USDC": {
    raydium: "DVa7Qmb5ct9RCpaU7qLggDHH5TgrniogczqjhhTe4iXqL", // ETH-USDC Orca/Meteora
    label: "Raydium ETH-USDC (DVa7Qm...)",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

/** Fetch Pyth Hermes price (no API key needed) */
async function fetchPythPrice(pair) {
  const id = PYTH_IDS[pair];
  const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${id}`;
  const data = await fetchWithTimeout(url);
  const parsed = data?.parsed?.[0]?.price;
  if (!parsed) throw new Error(`Pyth: no price for ${pair}`);
  // Pyth price is expo-adjusted: price * 10^expo
  const price = parseFloat(parsed.price) * Math.pow(10, parseInt(parsed.expo));
  const conf = parseFloat(parsed.conf) * Math.pow(10, parseInt(parsed.expo));
  return { price, conf };
}

/** Fetch DEX spot price via DexScreener (deepest pool for mainnet token) */
async function fetchDexPrice(pair) {
  const mint = MINTS[pair];
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
  const data = await fetchWithTimeout(url);

  // Sort by USD liquidity desc, pick deepest.
  // Pin quote token to canonical USDC mint to avoid brittle symbol-string matching
  // (multiple tokens on Solana share the "USDC" symbol but only one is mainnet USDC).
  const pairs = (data?.pairs ?? [])
    .filter(
      (p) =>
        p.chainId === "solana" &&
        p.quoteToken?.address === USDC_MINT
    )
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

  if (pairs.length === 0) {
    // No USDC-quoted pool found on DexScreener — try Jupiter as independent spot source
    return await fetchJupiterPrice(pair);
  }

  const top = pairs[0];
  const liquidity = top.liquidity?.usd ?? 0;

  // If the deepest DexScreener pool is below our minimum threshold, its price feed
  // is likely stale / thin (e.g. cbBTC's $0.4M frozen pool). Fall back to Jupiter
  // which aggregates live on-chain reserves across all AMMs.
  // IMPORTANT: fetchJupiterPrice does NOT call fetchPythPrice — that would cause a
  // Pyth-vs-Pyth comparison and always show 0% deviation for thin-liq pairs.
  if (liquidity < MIN_DEX_LIQUIDITY_USD) {
    console.log(
      `  [${pair}] DexScreener pool liq $${(liquidity / 1e6).toFixed(2)}M < $${(MIN_DEX_LIQUIDITY_USD / 1e6).toFixed(0)}M threshold — falling back to Jupiter`
    );
    return await fetchJupiterPrice(pair);
  }

  const price = parseFloat(top.priceUsd ?? "0");
  if (!isFinite(price) || price <= 0) throw new Error(`DexScreener: invalid price for ${pair}`);

  return {
    price,
    source: `DexScreener ${top.dexId} (liq $${(liquidity / 1e6).toFixed(1)}M)`,
    pool: top.pairAddress,
    liquidity,
  };
}

/**
 * Last-resort price source: Jupiter price API v2.
 *
 * NOTE: Do NOT call fetchPythPrice from here. This function exists to provide an
 * *independent* spot price to compare against Pyth. Calling Pyth from both sides
 * of the comparison would always yield 0% deviation and defeat the accuracy test.
 *
 * Jupiter price API v2 requires auth as of Mar 2026; supply JUPITER_API_KEY env var.
 * If Jupiter is also unavailable, this throws and the sample is recorded as an error.
 */
async function fetchJupiterPrice(pair) {
  const mint = MINTS[pair];
  const jupiterKey = process.env.JUPITER_API_KEY ?? "";
  const headers = jupiterKey ? { "Authorization": `Bearer ${jupiterKey}` } : {};
  const url = `https://api.jup.ag/price/v2?ids=${mint}`;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(id);
    if (!res.ok) throw new Error(`Jupiter API HTTP ${res.status} (auth required?)`);
    const data = await res.json();
    const priceStr = data?.data?.[mint]?.price;
    if (!priceStr) throw new Error(`Jupiter: no price for ${pair}`);
    const price = parseFloat(priceStr);
    if (!isFinite(price) || price <= 0) throw new Error(`Jupiter: invalid price for ${pair}`);
    return { price, source: "Jupiter price API", pool: "N/A", liquidity: 0 };
  } catch (err) {
    throw new Error(`No live independent price source for ${pair}: ${err.message}`);
  }
}

/** Calculate % deviation between two prices */
function pctDeviation(a, b) {
  return (Math.abs(a - b) / b) * 100;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAIRS = ["SOL/USDC", "BTC/USDC", "ETH/USDC"];

// Accumulate samples per pair
const stats = {};
for (const p of PAIRS) {
  stats[p] = { deviations: [], errors: 0, dexPrices: [], pythPrices: [] };
}

function printSampleRow(sample, n, total) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`\n─── Sample ${n}/${total} @ ${ts} ───`);
  for (const [pair, result] of Object.entries(sample)) {
    if (result.error) {
      console.log(`  ${pair.padEnd(10)} ERROR: ${result.error}`);
    } else {
      const sign = result.deviation >= 0 ? "+" : "";
      console.log(
        `  ${pair.padEnd(10)} DEX=${result.dexPrice.toFixed(4)} (${result.dexSource})` +
          ` | Pyth=${result.pythPrice.toFixed(4)} (±${result.pythConf.toFixed(4)})` +
          ` | Δ=${sign}${result.deviation.toFixed(4)}%`
      );
    }
  }
}

function printFinalReport() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  HYPERP vs Pyth Accuracy Report");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Samples attempted: ${SAMPLE_COUNT}`);
  console.log(`  Interval: ${INTERVAL_MS / 1000}s`);
  console.log("");

  const PASS_MAX = 0.5;
  const PASS_AVG = 0.25;
  let allPass = true;

  for (const pair of PAIRS) {
    const s = stats[pair];
    const n = s.deviations.length;
    if (n === 0) {
      console.log(`  ${pair}: NO VALID SAMPLES (${s.errors} errors) ❌`);
      allPass = false;
      continue;
    }
    const min = Math.min(...s.deviations).toFixed(4);
    const max = Math.max(...s.deviations).toFixed(4);
    const avg = (s.deviations.reduce((a, b) => a + b, 0) / n).toFixed(4);
    const p95 = [...s.deviations].sort((a, b) => a - b)[Math.floor(n * 0.95)] ?? max;

    const maxOk = parseFloat(max) < PASS_MAX;
    const avgOk = parseFloat(avg) < PASS_AVG;
    const pass = maxOk && avgOk;
    if (!pass) allPass = false;

    console.log(`  ${pair} (${n} samples, ${s.errors} errors):`);
    console.log(
      `    min=${min}%  max=${max}%  avg=${avg}%  p95=${p95.toFixed(4)}%  ${pass ? "✅ PASS" : "❌ FAIL"}`
    );
    if (!maxOk) console.log(`    ⚠️  max deviation ${max}% exceeds threshold ${PASS_MAX}%`);
    if (!avgOk) console.log(`    ⚠️  avg deviation ${avg}% exceeds threshold ${PASS_AVG}%`);
  }

  console.log("");
  console.log(
    `  Pass criteria: max <${PASS_MAX}%  avg <${PASS_AVG}%`
  );
  console.log(`  Overall: ${allPass ? "✅ ALL PASS — Oracle accuracy within mainnet thresholds" : "❌ FAIL — Review deviations above"}`);
  console.log("══════════════════════════════════════════════════════════════\n");

  return allPass;
}

async function takeSample() {
  const sample = {};
  await Promise.all(
    PAIRS.map(async (pair) => {
      try {
        const [pyth, dex] = await Promise.all([fetchPythPrice(pair), fetchDexPrice(pair)]);
        const deviation = pctDeviation(dex.price, pyth.price);
        sample[pair] = {
          dexPrice: dex.price,
          dexSource: dex.source,
          pythPrice: pyth.price,
          pythConf: pyth.conf,
          deviation,
        };
        stats[pair].deviations.push(deviation);
        stats[pair].dexPrices.push(dex.price);
        stats[pair].pythPrices.push(pyth.price);
      } catch (err) {
        sample[pair] = { error: err.message };
        stats[pair].errors++;
      }
    })
  );
  return sample;
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  HYPERP vs Pyth Accuracy Test — Mainnet Gate");
  console.log(`  ${SAMPLE_COUNT} samples × ${INTERVAL_MS / 1000}s interval = ~${Math.round((SAMPLE_COUNT * INTERVAL_MS) / 60000)} min`);
  console.log("══════════════════════════════════════════════════════════════");

  for (let i = 1; i <= SAMPLE_COUNT; i++) {
    const sample = await takeSample();
    printSampleRow(sample, i, SAMPLE_COUNT);

    if (i < SAMPLE_COUNT) {
      process.stdout.write(`  [waiting ${INTERVAL_MS / 1000}s for next sample...]`);
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      process.stdout.write("\r" + " ".repeat(50) + "\r");
    }
  }

  const passed = printFinalReport();
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
