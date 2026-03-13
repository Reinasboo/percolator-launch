# Percolator Launch — Security Audit Report
**Audit #3 (Full Monorepo — incremental update)**
**Date:** 2026-03-06
**Audited commit:** `a58b2cd` (`main`, `upstream/main`)
**Previous audit baseline:** `f85e244` (Audit #2, 2026-03-05)
**Commits reviewed in this update:** 57 files changed across ~50 commits since `f85e244`
**Auditor:** GitHub Copilot (automated static analysis)

> **This document is a living report.** Each audit updates all finding statuses in-place and appends new findings. Prior audit history is preserved in section headers.

---

## Audit History

| Audit | Date | Baseline Commit | New Findings | Fixed |
|-------|------|----------------|--------------|-------|
| #1 | 2026-03-01 | `fefe2d4` | 11 | — |
| #2 | 2026-03-05 | `f85e244` (+158 commits) | 6 new, 4 fixed | F1, F2, F4, F8 |
| #3 | 2026-03-06 | `a58b2cd` (+50 commits) | 3 new, 2 fixed | PERC-469, N2a-partial |

---

## Table of Contents
1. [Scope](#scope)
2. [First Audit Finding Status](#1-first-audit-finding-status)
3. [New Findings](#2-new-findings)
4. [Informational Notes](#3-informational-notes)
5. [Summary Table](#4-summary-table)
6. [Appendix — Files Reviewed](#5-appendix--files-reviewed)

---

## Scope

### Audit #2 (`fefe2d4` → `f85e244`, 158 commits)
Major new surface area reviewed: `bots/oracle-keeper/`, `bots/devnet-mm/`, `/api/faucet`, `/api/auto-fund`, `/api/airdrop`, `/api/devnet-mint-token`, `/api/oracle/publishers`, `/api/oracle/resolve/[ca]`, `/api/trader/[wallet]/trades`, `/api/leaderboard`, revised `app/middleware.ts`, `app/next.config.ts`, `packages/shared/src/networkValidation.ts`, `scripts/auto-crank-service.ts`, `scripts/crank-generic.ts`, `package.json` pnpm overrides.

### Audit #3 (`f85e244` → `a58b2cd`, ~50 commits)
New surface area reviewed (57 changed files):

- `app/app/api/devnet-mirror-mint/route.ts` — new: create devnet SPL mirror mint (326 lines)
- `app/app/api/devnet-pre-fund/route.ts` — new: pre-fund devnet wallet for market creation (273 lines)
- `app/app/api/oracle-keeper/register/route.ts` — new: hot-register market with oracle keeper (135 lines)
- `app/app/api/stake/pools/route.ts` — new: live on-chain stake pool data (397 lines)
- `app/app/api/rpc/route.ts` — revised: full RPC proxy with allowlist, caching, multi-network support
- `app/components/admin/OracleAdminSection.tsx` — new: admin UI for `SetOracleAuthority` (318 lines)
- `app/app/admin/page.tsx` — revised: added `OracleAdminSection` (318 lines)
- `bots/oracle-keeper/index.ts` — revised: +198 lines — Supabase auto-discovery, `fetchPriceByCA()`, input validation
- `packages/keeper/src/services/crank.ts` — revised: +87 lines
- `supabase/migrations/032_devnet_mints.sql`, `033_markets_mainnet_ca.sql` — new migrations
- `app/.env.example` — revised: Helius key exposure fix, +14 lines

---

## 1. First Audit Finding Status

### F1 — Unauthenticated `GET /api/applications` exposes PII
**Original Severity:** High
**Status: ✅ FIXED**

`requireAuth` guard confirmed present in the current `app/app/api/applications/route.ts`:
```ts
export async function GET(req: NextRequest) {
  if (!requireAuth(req)) return UNAUTHORIZED;
  // ...
}
```

---

### F2 — Unauthenticated `GET /api/bugs` exposes vulnerability reports
**Original Severity:** High
**Status: ✅ FIXED**

`requireAuth` guard applied in commit `be48970` on branch `fix/unauth-bugs-get` (pushed to `Reinasboo/percolator-launch`). Guard confirmed present. PR to `dcccrypto/percolator-launch:main` has not yet been opened.

---

### F3 — `scripts/crank-generic.ts` defaults to mainnet-beta RPC when `RPC_URL` is unset
**Original Severity:** High
**Status: ❌ STILL OPEN**
**File:** `scripts/crank-generic.ts`, line 52

```ts
const connection = new Connection(
  process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed"
);
```

If an operator runs `crank-generic.ts` on a devnet machine without setting `RPC_URL`, the crank connects silently to mainnet-beta. Unlike `auto-crank-service.ts`, this file has **not** been refactored to use `ensureNetworkConfigValid()`. A single mistaken run could crank against a production market with a devnet keypair (resulting in transaction failures that can mask the misconfiguration).

**Recommended fix:** Replace the inline fallback with a mandatory env var check:
```ts
const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) {
  console.error("❌ RPC_URL env var is required. Refusing to start without an explicit endpoint.");
  process.exit(1);
}
const connection = new Connection(rpcUrl, "confirmed");
```

---

### F4 — `auto-crank-service.ts` undefined `payer` variable → guaranteed runtime crash
**Original Severity:** High
**Status: ✅ FIXED**

The crank service has been fully rearchitected. It now uses `getSealedSigner()` from `packages/shared/src/signer.ts` and `ensureNetworkConfigValid()` from `packages/shared/src/networkValidation.ts`. The service validates `NETWORK`, `PROGRAM_ID`, and `RPC_URL` at startup and throws descriptive errors before any market interaction. No undefined variable reference remains.

---

### F5 — CVE-2025-3194: `bigint-buffer@1.1.5` buffer overflow (CVSS 7.5)
**Original Severity:** High
**Status: ❌ STILL OPEN**
**File:** `pnpm-lock.yaml` (two entries at lines 4077 and 13260)

`bigint-buffer@1.1.5` is still resolved by pnpm as a transitive dependency of `@solana/web3.js`. The root `package.json` `pnpm.overrides` section does not include a `bigint-buffer` override entry. The CVSS 7.5 buffer overflow in native addons remains exploitable for any code path that processes attacker-supplied big integers.

No patched version of `bigint-buffer` exists. The mitigation is to override the dependency with a safe fork or inline replacement. Several Solana projects pin `@solana/web3.js` to versions ≥2.0 which remove `bigint-buffer` entirely.

**Recommended fix (pnpm override approach):**
```json
// package.json
"pnpm": {
  "overrides": {
    "bigint-buffer": "npm:bigint-buffer-safe@^1.0.0"
  }
}
```
Or upgrade `@solana/web3.js` to `^2.0.0` across all workspace packages.

---

### F6 — In-memory rate limiters reset on serverless cold starts
**Original Severity:** Medium
**Status: ⚠️ ACKNOWLEDGED / ACCEPTED**

New endpoints (`/api/trader/[wallet]/trades`, `/api/airdrop`, `/api/devnet-mint-token`) all use per-route in-memory `Map`-based rate limiters with the same pattern. The `middleware.ts` also uses an in-memory map. A comment in the trades route explicitly acknowledges the cold-start reset as an accepted serverless tradeoff. This is documented behaviour, not a regression.

**Residual risk:** Adversarial cold-start triggering (e.g., intentional request bursts to bypass limits) remains possible, but the risk is low for devnet-only endpoints.

---

### F7 — `skipPreflight: true` on production on-chain transactions
**Original Severity:** Medium
**Status: ❌ STILL OPEN**
**Files:** `scripts/auto-crank-service.ts:127`, `bots/oracle-keeper/index.ts` (all oracle push transactions)

`skipPreflight: true` is set on `sendAndConfirmTransaction` calls in both the crank service and the oracle keeper. This disables simulation before broadcast, meaning:
- Invalid transactions (wrong accounts, insufficient compute budget) will be broadcast and fail on-chain, consuming priority fees.
- Error messages from program logs are only available post-failure, making debugging harder.
- No local compute unit estimate is performed before sending.

This is a medium-severity operational risk, not a security vulnerability in the traditional sense. For a production oracle keeper running continuously, skipping preflight increases the chance of silent repeated failures burning SOL.

**Recommended fix:** Remove `skipPreflight: true` or add a comment justifying the reason for each callsite.

---

### F8 — CSP `'unsafe-eval'` applied globally
**Original Severity:** Medium
**Status: ✅ FIXED**

Removed in commit `f4fea6e`. Current `middleware.ts` implements a nonce-based CSP. Comment in source documents that 241 production chunks were audited and confirmed to contain no `eval()`, `new Function()`, or string-arg `setTimeout()` calls. `'unsafe-inline'` remains as a CSP2 fallback (acceptable when nonce is present — browsers that support nonces ignore the `unsafe-inline` fallback).

---

### F9 — Hardcoded Railway hostname in health route
**Original Severity:** Low
**Status: ❌ STILL OPEN**
**File:** `app/app/api/health/route.ts`, line 7

```ts
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://percolator-api1-production.up.railway.app";
```

The hardcoded fallback embeds a specific production service URL. If the Railway deployment URL ever changes (redeploy, rename, migration to another host), the health check silently probes the wrong endpoint and returns misleading health status. The same URL is also hardcoded in `app/next.config.ts:4` as a fallback for the API reverse proxy rewrites.

**Recommended fix:** Make `NEXT_PUBLIC_API_URL` a required env var with no default, and add validation at app startup.

---

### F10 — Non-anchored public key validation regex in `sealedKeypair.ts`
**Original Severity:** Low
**Status: ❌ STILL OPEN**
**File:** `packages/shared/src/sealedKeypair.ts`, line 140

```ts
if (!/[1-9A-HJ-NP-Z]{40,45}/.test(publicKey)) {
```

The regex is missing `^` (start) and `$` (end) anchors. An input like `!!!invalidprefix_FxfD37s1AZTeWfFQ_invalidsuffix!!!` would pass validation if it contains a 40-character substring matching the character class. 

Note: `networkValidation.ts:88` has an identical defect with a slightly wider character class (`[1-9A-HJ-NP-Za-km-z]`), introduced as new code in this audit period (see N4).

**Recommended fix:**
```ts
if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey)) {
```

---

### F11 — `WS_AUTH_REQUIRED=false` default in `.env.example`
**Original Severity:** Low
**Status: ❌ STILL OPEN**
**Files:** `.env.example:43`, `packages/api/.env.example:17`

Both example files ship with `WS_AUTH_REQUIRED=false`. Operators who copy-paste the example file without reading it will deploy a WebSocket API with authentication disabled. This is a documentation/onboarding risk.

**Recommended fix:** Change to `WS_AUTH_REQUIRED=true` in both example files, with a comment: `# Set to false only for local development`.

---

### PERC-469 — `NEXT_PUBLIC_HELIUS_API_KEY` exposed in client-side JavaScript bundle
**Discovered:** Audit #3
**Severity: High**
**Status: ✅ CODE FIXED (`a3c9e73`) — ⚠️ ACTION REQUIRED: Helius API key must be rotated**
**File (pre-fix):** `app/components/PrivyProviderClient.tsx`

`PrivyProviderClient.tsx` built Helius RPC URLs using `NEXT_PUBLIC_HELIUS_API_KEY`:

```ts
// Before fix (removed in a3c9e73):
rpcConfig: {
  rpcUrls: {
    "solana:mainnet": {
      http: [`https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`],
    },
  },
},
```

All `NEXT_PUBLIC_*` env vars in Next.js are inlined into the client-side bundle at build time and served to every user in the JavaScript payload. Any visitor could extract the API key from browser DevTools → Network tab → Source.

**Fix applied in `a3c9e73`:**
- `NEXT_PUBLIC_HELIUS_API_KEY` references removed from `PrivyProviderClient.tsx` and `app/.env.example`
- `PrivyProviderClient.tsx` now routes RPC calls through `/api/rpc` proxy, which reads `HELIUS_API_KEY` (server-only env var) on the server side
- `/api/rpc` implements an `ALLOWED_RPC_METHODS` allowlist, deduplication, and response caching

**Mandatory follow-up action:** The Helius API key that was live in the bundle prior to `a3c9e73` was publicly visible to every user of the app and must be considered compromised. The key must be **rotated in the Helius dashboard** and the new key deployed to Vercel/Railway env vars as `HELIUS_API_KEY` (server-only). The old `NEXT_PUBLIC_HELIUS_API_KEY` env var should be deleted from all deployment environments.

---

## 2. New Findings

### N1 — `bots/devnet-mm`: Keypair JSON not scrubbed from `process.env` after materialization to disk
**Severity: Medium**
**File:** `bots/devnet-mm/src/index.ts`, lines 47–81

The `materializeKeypairFromEnv()` function writes `FILLER_KEYPAIR_JSON`, `MAKER_KEYPAIR_JSON`, and `BOOTSTRAP_KEYPAIR_JSON` env var values (raw 64-byte keypair JSON arrays) to `/tmp/percolator-bots/*.json`, then sets `process.env[pathEnvVar]` to the file path. However, **the original JSON env vars are never deleted**.

For contrast, `bots/oracle-keeper/index.ts` correctly calls `delete process.env.ADMIN_KEYPAIR` immediately after constructing the `Keypair` object.

**Impact:** For the entire lifetime of the devnet-mm process:
- The raw 64-byte private key is accessible as `process.env.FILLER_KEYPAIR_JSON` (etc.)
- Any error reporting SDK (Sentry, Datadog), debug logger, crash reporter, or child process that inherits the environment can read the full keypair JSON
- On Linux, `/proc/<PID>/environ` exposes the live process environment to any user with ptrace permission on the process

**Recommended fix:**
```ts
// After: process.env[pathEnvVar] = filePath;
// Add:
delete process.env[envVar]; // scrub raw key bytes from environment
```

---

### N2 — `/api/faucet`, `/api/auto-fund`, `/api/airdrop`, `/api/devnet-mint-token`: No authentication; devnet guard defaults to allow when env var is unset
**Severity: Medium**
**Files:** `app/app/api/faucet/route.ts`, `app/app/api/auto-fund/route.ts`, `app/app/api/airdrop/route.ts`, `app/app/api/devnet-mint-token/route.ts`

**Audit #3 update (partial fix applied):** Commit `3c2d860` (fix/PERC-752) changed the client-side config files to default to `"mainnet"`. `devnet-mint-token/route.ts` was also updated to `?? "mainnet"`. Additionally, two new Audit #3 endpoints (`devnet-pre-fund`, `devnet-mirror-mint`) were designed from the start with `?? "mainnet"` (fail-closed). However, the three original minting endpoints — `faucet`, `auto-fund`, and `airdrop` — **were NOT updated** and still read `?? "devnet"` (fail-open).

**N2a — Still open for faucet/auto-fund/airdrop:**
```ts
// faucet/route.ts:33, auto-fund/route.ts:28, airdrop/route.ts:29 — unchanged:
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
```

**N2b — Still open for all four endpoints:**
There is no per-request authentication on any of the four endpoints. Rate limiting relies on a per-wallet-address database lookup, but the wallet address is caller-supplied — an attacker can rotate wallet addresses (generate fresh keypairs) to bypass the 24-hour window entirely. The global middleware rate limiter (120 req/min per IP) is the only remaining control.

**Impact:**
- An attacker rotating wallet addresses can call `/api/airdrop` up to 120 times per minute per IP, minting unlimited devnet tokens from the mint authority
- The mint authority's SOL balance can be drained through repeated mint operations (each costs ~5000–10000 lamports in transaction fees)
- `/api/devnet-mint-token` can be called with arbitrary contract addresses, creating unbounded rows in `devnet_mints` and `markets` tables
- `/api/devnet-mint-token` returns real-time `priceUsd` in the response, functioning as a free unauthenticated DexScreener proxy

**Recommended fix:** Apply `requireAuth` (or a new `DEVNET_API_SECRET` env var check) to all four endpoints. At minimum, change the remaining three fail-open routes:
```ts
// Replace in faucet/route.ts, auto-fund/route.ts, airdrop/route.ts:
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
if (NETWORK !== "devnet") {
  return NextResponse.json({ error: "Only available on devnet" }, { status: 403 });
}
```

---

### N3 — `/api/oracle/publishers`: Internal error details leaked in 500 response body
**Severity: Low**
**File:** `app/app/api/oracle/publishers/route.ts`, line 112

```ts
return NextResponse.json(
  { error: "Failed to fetch publisher data", detail: String(err) },
  { status: 500 },
);
```

`detail: String(err)` is returned unconditionally to the client in all internal error cases. Depending on the error, `String(err)` can contain:
- Internal service URLs (e.g., the `ORACLE_BRIDGE_URL` value including any credentials in the URL)
- Pythnet RPC connection strings
- File paths from TypeScript stack traces
- Supabase error messages including table or column names

**Recommended fix:** Remove the `detail` field from the response. The error is already logged server-side via `console.error("[oracle/publishers] Error:", err)` on the line above.

---

### N4 — `packages/shared/src/networkValidation.ts`: Non-anchored regex for `PROGRAM_ID` validation (same class as F10)
**Severity: Low**
**File:** `packages/shared/src/networkValidation.ts`, line 88

```ts
if (!/[1-9A-HJ-NP-Za-km-z]{40,45}/.test(programIdEnv)) {
```

Identical defect to F10. Missing `^` and `$` anchors allow a string like `INVALID_PREFIX_FxfD37s1AZTeWfFQps9Zpebi2dNQ9QSSDtfMKdbsfKrD_INVALID_SUFFIX` to pass validation. New code introduced in this audit period — not present in first audit.

**Recommended fix:**
```ts
if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programIdEnv)) {
```

---

### N5 — `DEVNET_MINT_AUTHORITY_KEYPAIR` secret undocumented in `app/.env.example`
**Severity: Low**
**File:** `app/.env.example`

The `DEVNET_MINT_AUTHORITY_KEYPAIR` environment variable is used across four production API routes (`/api/faucet`, `/api/auto-fund`, `/api/airdrop`, `/api/devnet-mint-token`) but has **no entry** in `app/.env.example`. There is no documentation of:
- The expected format (JSON array of 64 bytes)
- That this key must be kept secret and never committed
- Minimum SOL balance requirement for continued operation
- Key rotation procedures

A developer setting up a new deployment will have no guidance that this variable needs to be provisioned.

**Recommended fix:** Add to `app/.env.example`:
```
# Devnet mint authority keypair (JSON array of 64 bytes) — KEEP SECRET, never commit
# Required for: /api/faucet, /api/auto-fund, /api/airdrop, /api/devnet-mint-token
# Generate: solana-keygen new --no-bip39-passphrase --outfile /tmp/mint-auth.json && cat /tmp/mint-auth.json
DEVNET_MINT_AUTHORITY_KEYPAIR=
```

---

## 3. Informational Notes

### I1 — `/api/airdrop`: Unused `ORACLE_BRIDGE_URL` constant
**File:** `app/app/api/airdrop/route.ts`, line 31

```ts
const ORACLE_BRIDGE_URL = process.env.ORACLE_BRIDGE_URL ?? "http://127.0.0.1:18802";
```

This constant is declared but never used. A code comment indicates it was removed in favour of the `markets_with_stats` Supabase view. The dead constant misleads code readers about the price data source and should be removed.

---

### N7 — `bug_reports` RLS: column-level restrictions only apply to `anon` role; `authenticated` users can read PII fields
**Discovered:** Audit #3
**Severity: Medium**
**File:** `supabase/migrations/026_fix_pii_exposure.sql`

Migration `026_fix_pii_exposure.sql` was introduced to prevent `bug_reports` PII leakage by revoking direct table access from the `anon` (unauthenticated) Supabase role and granting only a safe subset of columns:

```sql
REVOKE SELECT ON bug_reports FROM anon;
GRANT SELECT (id, title, description, status, severity, created_at, updated_at)
  ON bug_reports TO anon;
```

**The problem:** The restriction only targets the `anon` role. The `authenticated` role (any user who has created a Supabase account and is signed in) is **not restricted**. The original `006_bug_reports.sql` migration created a universal SELECT policy:

```sql
-- From 006_bug_reports.sql:
CREATE POLICY "Bug reports readable by all"
  ON bug_reports FOR SELECT
  USING (true);
```

Because this policy still exists and uses `USING (true)`, any `authenticated` user can read the full `bug_reports` table — including `ip` (submitter IP address) and `admin_notes` — via the PostgREST API endpoint (`GET /rest/v1/bug_reports`). Supabase allows open email/password account creation by default unless explicitly disabled in the Supabase dashboard.

**Attack path:**
1. Attacker registers a Supabase account with any email/password at the project's auth URL
2. Attacker calls `GET /rest/v1/bug_reports` with the resulting JWT `Authorization: Bearer <token>`
3. All IP addresses and admin notes are returned in the response

**Recommended fix:** Add the `authenticated` role to the same column-level restriction in a new migration:

```sql
-- New migration: 034_fix_pii_authenticated_role.sql
REVOKE SELECT ON bug_reports FROM authenticated;
GRANT SELECT (id, title, description, status, severity, created_at, updated_at)
  ON bug_reports TO authenticated;
```

Also review whether unrestricted `SELECT` access to `admin_users` (any `authenticated` user can enumerate admin email addresses per migration `016_admin_users.sql`) is intentional.

---

### N8 — `WS_AUTH_SECRET` hardcoded to a well-known value in public example file
**Discovered:** Audit #3
**Severity: Low**
**File:** `packages/api/.env.example`

```
WS_AUTH_SECRET=percolator-ws-secret-change-in-production
```

The `WS_AUTH_SECRET` value in the public example file is a known, static string embedded in the repository. Any operator who copies `packages/api/.env.example` and deploys without replacing this value will run with a WebSocket authentication secret that is publicly visible in the GitHub repository history. This defeats the purpose of `WS_AUTH_REQUIRED=true` — an attacker can authenticate to the WebSocket API using the disclosed secret.

This is compounded by F11 (`WS_AUTH_REQUIRED=false` default in the same file): if an operator copies the example unchanged, WebSocket auth is both disabled and using a known secret.

**Recommended fix:** Change the example value to an empty placeholder:
```
# Generate a strong random value: openssl rand -base64 32
WS_AUTH_SECRET=
```

---

### I2 — `bots/oracle-keeper`: `HEALTH_AUTH_TOKEN` optional — health endpoint unauthenticated if not set
**File:** `bots/oracle-keeper/index.ts`

The health HTTP server on `HEALTH_BIND:HEALTH_PORT` (defaults to `127.0.0.1`) can optionally require a bearer token via `HEALTH_AUTH_TOKEN`. If the variable is not set, the endpoint is accessible with no authentication. Since `HEALTH_BIND` defaults to loopback, this is low risk in standard deployments, but Railway deployments may bind to `0.0.0.0`. Operators should ensure `HEALTH_AUTH_TOKEN` is set in production.

---

### I3 — `bots/oracle-keeper`: `skipPreflight: true` on oracle push transactions (overlaps F7)
**File:** `bots/oracle-keeper/index.ts`

Same pattern as F7. Noted here as a new surface area added since first audit.

---

### I4 — CSP `frame-ancestors` allows `https://*.percolatorlaunch.com` (wildcard subdomain)
**File:** `app/middleware.ts`, `addSecurityHeaders()`

```
frame-ancestors 'self' https://percolatorlaunch.com https://*.percolatorlaunch.com https://percolator-launch.vercel.app
```

The wildcard `https://*.percolatorlaunch.com` allows any subdomain to embed the app in an iframe. If an attacker could register or compromise a subdomain (e.g., `evil.percolatorlaunch.com` via a dangling DNS record), they could use it as a clickjacking frame. This is low-risk if subdomain DNS is tightly controlled, but worth noting.

---

## 4. Summary Table

### Carryover Findings (from First Audit — `fefe2d4`)

| ID  | Title                                              | Severity | Status     |
|-----|----------------------------------------------------|----------|------------|
| F1  | Unauth `GET /api/applications` PII exposure        | High     | ✅ Fixed    |
| F2  | Unauth `GET /api/bugs` exposure                    | High     | ✅ Fixed    |
| F3  | `crank-generic.ts` mainnet RPC fallback            | High     | ❌ Open     |
| F4  | `auto-crank-service.ts` undefined `payer` crash    | High     | ✅ Fixed    |
| F5  | CVE-2025-3194 `bigint-buffer@1.1.5` (CVSS 7.5)    | High     | ❌ Open     |
| F6  | In-memory rate limiters reset on cold start        | Medium   | ⚠️ Accepted |
| F7  | `skipPreflight: true` in production scripts        | Medium   | ❌ Open     |
| F8  | CSP `'unsafe-eval'` globally applied               | Medium   | ✅ Fixed    |
| F9  | Hardcoded Railway hostname in health route         | Low      | ❌ Open     |
| F10 | Non-anchored pubkey regex in `sealedKeypair.ts`    | Low      | ❌ Open     |
| F11 | `WS_AUTH_REQUIRED=false` default in `.env.example` | Low      | ❌ Open     |

### Findings from Audit #2 (`f85e244`)

| ID  | Title                                                         | Severity      | Status                        |
|-----|---------------------------------------------------------------|---------------|-------------------------------|
| N1  | devnet-mm keypair JSON not scrubbed from `process.env`        | Medium        | ❌ Open                        |
| N2a | faucet/auto-fund/airdrop: `?? "devnet"` fail-open default     | Medium        | ❌ Open (3 of 6 routes remain) |
| N2b | faucet/auto-fund/airdrop/mint-token: no per-request auth      | Medium        | ❌ Open                        |
| N3  | `oracle/publishers` leaks `detail: String(err)` in 500s       | Low           | ❌ Open                        |
| N4  | Non-anchored regex in `networkValidation.ts`                  | Low           | ❌ Open                        |
| N5  | `DEVNET_MINT_AUTHORITY_KEYPAIR` undocumented in `.env.example`| Low           | ❌ Open                        |
| N6  | Dead `ORACLE_BRIDGE_URL` import in `airdrop/route.ts`         | Informational | ❌ Open                        |

### Findings from Audit #3 (`a58b2cd`)

| ID         | Title                                                               | Severity | Status                                   |
|------------|---------------------------------------------------------------------|----------|------------------------------------------|
| PERC-469   | `NEXT_PUBLIC_HELIUS_API_KEY` exposed in client bundle               | High     | ✅ Code fixed (`a3c9e73`) — ⚠️ Rotate key |
| N7         | `bug_reports` RLS: `authenticated` role can read `ip`/`admin_notes` | Medium   | ❌ Open                                   |
| N8         | `WS_AUTH_SECRET` hardcoded well-known value in example file         | Low      | ❌ Open                                   |

### Totals

| Severity      | All Findings | Fixed / Accepted | Open |
|---------------|-------------|-----------------|------|
| High          | 6           | 3 fixed          | 3    |
| Medium        | 7           | 1 fixed, 1 accepted | 5 |
| Low           | 7           | 0                | 7    |
| Informational | 1           | 0                | 1    |
| **Total**     | **21**      | **5 fixed, 1 accepted** | **16** |

> **Rotation action item** — the Helius API key exposed prior to `a3c9e73` is not counted as an open code finding (code is fixed) but remains an outstanding operational action: the key must be rotated in Helius dashboard and new server-only `HELIUS_API_KEY` deployed to Vercel/Railway.

---

## 5. Appendix — Files Reviewed

### Audit #1 New Files (added since `fefe2d4`)
| File | Lines | Key Risk |
|------|-------|----------|
| `bots/oracle-keeper/index.ts` | 517 | skipPreflight, optional health auth |
| `bots/devnet-mm/src/index.ts` | 258 | keypair env not scrubbed (N1) |
| `bots/devnet-mm/src/config.ts` | 150 | hardcoded fallback program IDs |
| `app/app/api/faucet/route.ts` | ~200 | no auth, default-to-allow (N2a/b) |
| `app/app/api/auto-fund/route.ts` | ~197 | no auth, default-to-allow (N2a/b) |
| `app/app/api/airdrop/route.ts` | 224 | no auth, dead import (N2a/b, I1) |
| `app/app/api/devnet-mint-token/route.ts` | 283 | no auth (N2b), default now fixed (N2a ✅) |
| `app/app/api/oracle/publishers/route.ts` | 324 | error detail leak (N3) |
| `app/app/api/oracle/resolve/[ca]/route.ts` | 251 | no issues found |
| `app/app/api/trader/[wallet]/trades/route.ts` | 152 | no issues found |
| `app/app/api/leaderboard/route.ts` | 130 | anon client + ISR confirmed safe |
| `packages/shared/src/networkValidation.ts` | 160 | non-anchored regex (N4) |

### Audit #1 Modified Files
| File | Key Change |
|------|-----------|
| `app/app/api/applications/route.ts` | `requireAuth` guard added to GET (F1 fixed) |
| `app/app/api/bugs/route.ts` | `requireAuth` guard added to GET (F2 fixed) |
| `app/middleware.ts` | Nonce-based CSP, TRUSTED_PROXY_DEPTH for IP extraction (F8 fixed) |
| `app/next.config.ts` | Security headers, API proxy rewrites |
| `scripts/auto-crank-service.ts` | Full rearchitect with `getSealedSigner()` + `ensureNetworkConfigValid()` (F4 fixed) |
| `scripts/crank-generic.ts` | Unchanged in the relevant mainnet fallback area (F3 still open) |
| `packages/shared/src/sealedKeypair.ts` | Non-anchored regex unchanged (F10 still open) |
| `package.json` | pnpm overrides added for several CVEs, but NOT `bigint-buffer` (F5 still open) |

### Audit #3 New Files (added since `f85e244`)
| File | Lines | Key Notes |
|------|-------|-----------|
| `app/app/api/devnet-mirror-mint/route.ts` | 326 | PERC-456: devnet SPL mirror mint. Fail-closed default ✅, 10/min IP rate limit, generic error responses. No per-request auth (N2b class). |
| `app/app/api/devnet-pre-fund/route.ts` | 273 | PERC-744: pre-fund wallet for vault seed. Fail-closed default ✅, `DEVNET_ALLOWED_MINTS` allowlist, on-chain authority pre-flight. Minor: partial pubkey in authority-mismatch error. No per-request auth (N2b class). |
| `app/app/api/oracle-keeper/register/route.ts` | 135 | PERC-465: hot-register market. Auth-gated via `KEEPER_REGISTER_SECRET` shared secret ✅, all Solana addresses validated, generic error responses. No issues found. |
| `app/app/api/stake/pools/route.ts` | 397 | Live on-chain StakePool data + APR. Read-only, `getServiceClient()` server-side ✅. No issues found. |
| `app/components/admin/OracleAdminSection.tsx` | 318 | SetOracleAuthority admin UI. Client-side wallet-signed on-chain tx. No API security issues. |
| `supabase/migrations/026_fix_pii_exposure.sql` | — | Restricts `bug_reports` SELECT for `anon` only — `authenticated` role still unrestricted (N7). |
| `supabase/migrations/032_devnet_mints.sql` | — | No security issues found. |
| `supabase/migrations/033_markets_mainnet_ca.sql` | — | No security issues found. |

### Audit #3 Modified Files
| File | Key Change | Security Impact |
|------|-----------|-----------------|
| `app/app/api/rpc/route.ts` | Full RPC proxy with `ALLOWED_RPC_METHODS`, MAX_BATCH_SIZE=40, dedup cache, `?network=` param | PERC-469 fixed (server-side key) |
| `bots/oracle-keeper/index.ts` | +198 lines: Supabase auto-discovery, `/register` endpoint, `fetchPriceByCA()` with base58 validation + `encodeURIComponent` | Oracle URL injection fixed (#782–784) |
| `app/components/PrivyProviderClient.tsx` | `NEXT_PUBLIC_HELIUS_API_KEY` removed; RPC routed through `/api/rpc` | PERC-469 fixed |
| `app/.env.example` | `NEXT_PUBLIC_HELIUS_API_KEY` removed | PERC-469 fixed |
| `packages/api/.env.example` | `WS_AUTH_SECRET=percolator-ws-secret-change-in-production` added | N8: hardcoded known secret |
| `app/app/api/devnet-mint-token/route.ts` | `?? "devnet"` → `?? "mainnet"` (PERC-752) | N2a partially fixed for this route |
| `app/app/admin/page.tsx` | Added `OracleAdminSection` import | No security issues |
| `packages/keeper/src/services/crank.ts` | +87 lines crank service refactor | No new issues |

---

*Report generated by automated static analysis. All findings should be verified by a human reviewer before acting on them. This report does not cover runtime behaviour, business logic correctness, or Solana program (on-chain) code.*
