# Percolator Launch Security Audit Report
**Date:** March 13, 2026  
**Scope:** Full codebase security review

---

## Executive Summary

This audit identified **13 security findings** across the Percolator Launch codebase, ranging from CRITICAL to LOW severity. Major concerns include:

1. **Private key exposure via environment variables** (CRITICAL)
2. **Hardcoded demo credentials in version control** (HIGH)
3. **Unsafe transaction preflight skipping** (HIGH)
4. **Missing authorization on sensitive APIs** (HIGH)
5. **Service role key exposure in Supabase queries** (MEDIUM)

---

## CRITICAL FINDINGS

### 1. Private Key Exposure via Environment Variable

**File:** [bots/oracle-keeper/index.ts](bots/oracle-keeper/index.ts)  
**Lines:** 72-79  
**Severity:** CRITICAL

**Issue:**
```typescript
const adminSecretKey = process.env.ADMIN_KEYPAIR
  ? Uint8Array.from(JSON.parse(process.env.ADMIN_KEYPAIR))
  : Uint8Array.from(JSON.parse(fs.readFileSync(ADMIN_KP_PATH, "utf8")));
const admin = Keypair.fromSecretKey(adminSecretKey);

if (process.env.ADMIN_KEYPAIR) {
  delete process.env.ADMIN_KEYPAIR;
}
```

**Problems:**
- Private key passed as JSON via `ADMIN_KEYPAIR` environment variable
- Environment variables are logged in container startup, child processes, and crash dumps
- Secret is deleted AFTER being parsed, but leaked to process memory
- No way to ensure the keypair bytes don't land in logs/debuggers during `JSON.parse()`
- If process crashes before the `delete` statement, secret remains in environment

**Attack Vector:**
- Container logs exposure
- Process inspection tools
- Memory dumps
- Child process inheritance
- Deployment logs

**Recommendation:**
- Load keypair from secure file only, never from environment
- Use Docker secrets or HashiCorp Vault for production
- If env var is necessary, zeroize memory immediately after use
- Add memory zeroization for keypair arrays

---

### 2. Hardcoded Demo/Test Credentials in Source Control

**File:** [.env](.env)  
**Lines:** 11, 25, 26  
**Severity:** HIGH

**Issue:**
```
HELIUS_API_KEY=demo-key        # Line 11
API_AUTH_KEY=test-auth-key     # Line 25
WS_AUTH_SECRET=test-ws-secret  # Line 26
```

**Problems:**
- Test credentials committed to version control
- If credentials rotate, old commits still expose them
- Anyone with repo access can extract these
- Could be extracted by automated secret scanners if leaked

**Recommendation:**
- Move `.env` to `.env.example` with placeholder values only
- Use `.env.local` (gitignored) for development
- Use CI/CD secrets for deployment environments
- Implement pre-commit hooks to block secrets

---

## HIGH SEVERITY FINDINGS

### 3. unsafe Solana RPC Configuration: skipPreflight=true

**Files:**
- [bots/devnet-mm/src/rpc.ts](bots/devnet-mm/src/rpc.ts) - Line 219
- [bots/devnet-mm/src/market.ts](bots/devnet-mm/src/market.ts) - Lines 256
- [packages/shared/src/utils/solana.ts](packages/shared/src/utils/solana.ts) - Lines 21, 282-335
- [tests/t8-trading-fee-update.ts](tests/t8-trading-fee-update.ts) - Line 182
- [tests/t7-market-pause.ts](tests/t7-market-pause.ts) - Lines 221, 278, 377

**Severity:** HIGH

**Issue:**
```typescript
// packages/shared/src/utils/solana.ts, Line 21
const DEFAULT_KEEPER_OPTS: Required<KeeperSendOptions> = {
  skipPreflight: true,        // ⚠️ UNSAFE
  multiRpcBroadcast: true,
  simulateForCU: true,
};
```

**Problems:**
- Skipping preflight allows invalid transactions to broadcast
- Transactions consume SOL fees even if doomed to fail
- No client-side opportunity to catch constraint violations
- No balance checks, invalid accounts, invalid instruction data detected
- Keeper bot can burn SOL on failed transactions

**Attack Scenarios:**
- Oracle keeper pushes invalid prices repeatedly, draining SOL
- Malformed transactions broadcast due to off-by-one errors in serialization
- Missing accounts lead to failed transactions but depleted fee wallet

**Impacts:**
- Production: Keeper wallet drained unintentionally
- Mainnet: Repeated failed transactions visible on-chain

**Recommendation:**
- Set `skipPreflight: false` for critical keeper operations
- Use `preflightCommitment: "confirmed"` or `"processed"` explicitly
- Simulate transactions before broadcasting in production
- Monitor failed transaction frequency and alert on anomalies

---

### 4. Missing Authorization Checks on Internal/Admin APIs

**File:** [app/app/api/leaderboard/route.ts](app/app/api/leaderboard/route.ts)  
**Lines:** 30+  
**Severity:** HIGH

**Issue:**
- `/api/leaderboard` is completely public
- No authentication required
- Returns aggregated trade data without restriction

**Related Unprotected Routes:**
- `/api/ideas` (Lines 27-50): Public idea endpoint, no auth
- `/api/launch` (Line 46): No authorization check visible
- `/api/devnet-*` endpoints: All public (devnet-focused, lower risk)

**Contrast with Protected Routes:**
- `/api/bugs` GET (Line 22): Has `requireAuth()`
- `/api/applications` GET (Line 28): Has `requireAuth()`
- `/api/admin/bugs` GET/PATCH: Has Supabase auth + admin check

**Recommendation:**
- Add authorization to any route handling sensitive operations
- Implement consistent auth middleware
- Document which routes are intentionally public vs internal

---

### 5. Supabase Service Role Key in Public Queries

**File:** [bots/oracle-keeper/index.ts](bots/oracle-keeper/index.ts)  
**Lines:** 101, 564-590, 639-660, 894, 916  
**Severity:** MEDIUM

**Issue:** Service role key exposed in Supabase REST queries

```typescript
// Line 101
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Line 564-590 - Lightweight REST query directly using service key
async function supabaseQuery(table: string, params: string): Promise<any[] | null> {
  if (!supabaseEnabled) return null;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${params}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,        // ⚠️ SERVICE KEY EXPOSED
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
```

**Problems:**
- Service role key is server-side only, should never be transmitted
- If Supabase URL is intercepted, service key might be exposed
- Service key bypasses all RLS (Row-Level Security)
- This is backend-to-backend (safe), but if exposed could compromise Supabase
- Plain HTTP sends Authorization header in clear text if HTTPS is misconfigured

**Risk Level:**
- LOW if Supabase URL is always HTTPS (which it should be)
- MEDIUM if deployed to insecure network
- CRITICAL if private key is logged alongside URL

**Recommendation:**
- Use Supabase JS client library instead of raw HTTP (handles auth better)
- Ensure all requests use HTTPS
- Rotate service role key periodically
- Monitor key usage for suspicious patterns
- Never log complete Authorization headers

---

## MEDIUM SEVERITY FINDINGS

### 6. Missing INDEXER_API_KEY Configuration in Production

**File:** [app/lib/api-auth.ts](app/lib/api-auth.ts)  
**Lines:** 6-31  
**Severity:** MEDIUM

**Issue:**
```typescript
export function requireAuth(req: NextRequest): boolean {
  const expectedKey = process.env.INDEXER_API_KEY;
  if (!expectedKey) {
    // R2-S9: In production, reject all requests if auth key is not configured
    if (process.env.NODE_ENV === "production") return false;
    return true; // No key configured = open (dev mode only)  // ⚠️ RISKY
  }
  // ... timing-safe comparison ...
}
```

**Problems:**
- If `INDEXER_API_KEY` is not set and `NODE_ENV !== "production"`, auth is bypassed
- Staging/test environments might accidentally have `NODE_ENV="staging"` and leak APIs
- Production correctly rejects, but error occurs silently

**Concern:** What if Vercel deployment accidentally has `NODE_ENV="development"`?

**Recommendation:**
- Explicitly document all deployment environment names: `production`, `staging`, `development`
- Add validation at startup to ensure required keys are present
- Fail-closed: require explicit opt-in to open mode, don't default to open

---

### 7. Insufficient Input Validation on PublicKey Parameters

**File:** Multiple API routes  
**Examples:**
- [app/app/api/faucet/route.ts](app/app/api/faucet/route.ts) - Lines 47-52
- [app/app/api/auto-fund/route.ts](app/app/api/auto-fund/route.ts) - Lines 50-60
- [app/app/api/devnet-airdrop/route.ts](app/app/api/devnet-airdrop/route.ts) - Lines 210-220

**Severity:** MEDIUM

**Issue:**
```typescript
let walletPk: PublicKey;
try {
  walletPk = new PublicKey(walletAddress);
} catch {
  return NextResponse.json(
    { error: "Invalid wallet address" },
    { status: 400 },
  );
}
```

**Problems:**
- Validation is basic: only checks if string is valid base58
- No check if wallet is on-curve vs off-curve (PDAs)
- No check for system accounts or special addresses
- [devnet-airdrop/route.ts](app/app/api/devnet-airdrop/route.ts) Line 230 adds curve check (good!), but others don't

**Example Risk:**
- User could pass a PDA address, causing transaction to fail on-chain
- Response leaks which addresses are invalid (information disclosure, low risk)

**Recommendation:**
- Consistently check `PublicKey.isOnCurve()` for all wallet inputs
- Add whitelist checks for any system/protocol accounts
- Consider adding wallet existence checks on-chain (optional for devnet)

---

### 8. Default Open RPC Fallback Could Rate-Limit

**File:** [app/lib/config.ts](app/lib/config.ts)  
**Lines:** 30-75  
**Severity:** MEDIUM

**Issue:**
```typescript
function buildHeliusUrl(network: "mainnet" | "devnet"): string {
  if (network === "mainnet") {
    const key = (process.env.HELIUS_MAINNET_API_KEY ?? process.env.HELIUS_API_KEY ?? "").trim();
    return key
      ? `https://mainnet.helius-rpc.com/?api-key=${key}`
      : "https://api.mainnet-beta.solana.com";  // ⚠️ PUBLIC RPC FALLBACK
  }
  // ...
}
```

**Problems:**
- If no API key configured, falls back to public Solana RPC
- Public RPC is heavily rate-limited
- No warning when switching to public RPC
- Application silently degrades instead of failing loudly

**Risk:**
- Production performance degradation
- Mainnet transactions fail silently due to rate limits
- Hard to debug since no explicit error message

**Recommendation:**
- Fail-closed: require explicit RPC URL or API key in production
- Log warnings when falling back to public RPC
- Add circuit breaker for public RPC usage
- Raise error if RPC is public on mainnet

---

### 9. Devnet Mint Authority Keypair Needs Secure Storage

**Files:**
- [app/app/api/devnet-mint-token/route.ts](app/app/api/devnet-mint-token/route.ts) - Line 90
- [app/app/api/devnet-pre-fund/route.ts](app/app/api/devnet-pre-fund/route.ts) - Line 90
- [app/app/api/devnet-mirror-mint/route.ts](app/app/api/devnet-mirror-mint/route.ts) - Line 30

**Severity:** MEDIUM

**Issue:**
Keypair is loaded from `DEVNET_MINT_AUTHORITY_KEYPAIR` env var (same pattern as `ADMIN_KEYPAIR`)

**Problems:**
- Same environment variable exposure risks as finding #1
- All three devnet routes load keypair from env
- Keysharing between multiple endpoints increases exposure surface
- If this keypair is compromised, attacker can mint unlimited devnet tokens

**Mitigation (Lower Risk Than Mainnet):**
- These are devnet-only endpoints, so actual financial loss is zero
- Devnet tokens have no real value
- Still risky for supply chain security (fake devnet token collateral)

**Recommendation:**
- Use secure keypair storage (file-based with restricted permissions)
- Never pass to multiple endpoints
- Consider using a separate mint authority per endpoint
- Rotate keys frequently on devnet

---

## MEDIUM SEVERITY (INFORMATIONAL)

### 10. Error Messages Could Expose Sensitive Information

**File:** Multiple locations  
**Examples:**
- [bots/oracle-keeper/index.ts](bots/oracle-keeper/index.ts) - Line 1008
- [app/app/api/admin/bugs/route.ts](app/app/api/admin/bugs/route.ts) - Line 83

**Severity:** LOW

**Issue:**
```typescript
// bots/oracle-keeper/index.ts Line 1008
main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
```

**Problems:**
- Stack traces logged to console might include private data
- Sentry error capture could include sensitive fields
- Database error messages might expose schema
- Network errors could leak internal IP addresses

**Mitigation Already Present:**
- Sentry integration has `tags` and `extra` for context
- Most errors are generic ("not found", "unauthorized")

**Recommendation:**
- Audit all error logging for PII
- Never log full stack traces to client
- Use Sentry breadcrumbs judiciously
- Sanitize error messages in responses

---

## LOW SEVERITY FINDINGS

### 11. RPC Endpoint Could Expose API Key in Logs

**File:** [app/app/api/rpc/route.ts](app/app/api/rpc/route.ts)  
**Lines:** 29-80  
**Severity:** LOW

**Issue:**
```typescript
const key = (process.env.HELIUS_MAINNET_API_KEY ?? process.env.HELIUS_API_KEY ?? "").trim();
return key
  ? `https://mainnet.helius-rpc.com/?api-key=${key}`
  : "https://api.mainnet-beta.solana.com";
```

**Problems:**
- API key in URL query parameter can be logged
- Browser history might contain RPC URL with key
- Proxy logs might capture full URL
- Error responses might include URL in message

**Current Mitigation:**
- This is server-side only (not exposed to client)
- Helius API key is read-only (rate limited per key, not account-takeover risk)

**Recommendation:**
- Use HTTP Authorization header instead of query param
- Never log full RPC URLs in Sentry
- Sanitize URLs in error messages

---

### 12. Devnet Guard Relies on NETWORK String (Build-Time)

**File:** [app/app/api/devnet-pre-fund/route.ts](app/app/api/devnet-pre-fund/route.ts)  
**Lines:** 41-50  
**Severity:** LOW

**Issue:**
```typescript
// PERC-482 fix: NETWORK env var is always "mainnet" on Vercel prod (build-time).
// The real devnet guard is the devnet_mints DB lookup below
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim() ?? "mainnet";
const ALLOW_MIRROR_MINTS = true;

export async function POST(req: NextRequest) {
  try {
    const isDevnetNetwork = NETWORK === "devnet";
    if (!isDevnetNetwork && !ALLOW_MIRROR_MINTS) {
      return NextResponse.json({ error: "Only available on devnet" }, { status: 403 });
    }
```

**Problems:**
- `ALLOW_MIRROR_MINTS = true` always passes the first check
- Real security is DB lookup (good), but misleading code
- Next person might not realize the NETWORK check is ineffective

**Recommendation:**
- Remove the dead `NETWORK` check or comment clearly why it's ignored
- Make security boundary explicit: "Only mirror mints are allowed"
- Consider renaming to `ALLOW_MIRROR_MINTS_ONLY` for clarity

---

### 13. Health Endpoint IP Binding Not Enforced Everywhere

**File:** [bots/oracle-keeper/index.ts](bots/oracle-keeper/index.ts)  
**Lines:** 84-88, 574-580  
**Severity:** LOW

**Issue:**
```typescript
// Line 84: Health endpoint security
const HEALTH_BIND = process.env.HEALTH_BIND ?? "127.0.0.1";

// Line 576: Authorization check
if (req.method === "GET" && req.url === "/health") {
  const localIps = ["127.0.0.1", "::1"];
  if (!localIps.includes(req.socket.remoteAddress || "")) {
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
```

**Problems:**
- Binding to 127.0.0.1 is good security
- Authorization check via IP is secondary safeguard (good defense-in-depth)
- But IP check could be spoofed if server is behind proxy without TRUSTED_PROXY_DEPTH

**Mitigation Already Present:**
- Primary control: `HEALTH_BIND` restricts listening interface
- Secondary control: IP check on requests
- Configuration allows customization

**Recommendation:**
- Document TRUSTED_PROXY_DEPTH requirement
- Add logs when health check is rejected (for debugging)

---

## SUMMARY TABLE

| Severity | Count | Finding | File |
|----------|-------|---------|------|
| CRITICAL | 1 | Admin keypair in env var | oracle-keeper/index.ts |
| HIGH | 4 | Demo credentials in .env | .env |
| HIGH | | skipPreflight=true | solana.ts, rpc.ts, market.ts, tests |
| HIGH | | Missing auth on APIs | leaderboard/route.ts |
| HIGH | | Service role key exposure | oracle-keeper/index.ts |
| MEDIUM | 6 | INDEXER_API_KEY fallback | api-auth.ts |
| MEDIUM | | PublicKey validation gaps | faucet, auto-fund, devnet-airdrop |
| MEDIUM | | RPC fallback not logged | config.ts |
| MEDIUM | | Devnet keypair storage | devnet-* routes |
| LOW | 3 | Error message PII | Various |
| LOW | | API key in URL logs | rpc/route.ts |
| LOW | | NETWORK check dead code | devnet-pre-fund |
| LOW | | Health endpoint proxy issues | oracle-keeper |

---

## RECOMMENDATIONS BY PRIORITY

### Phase 1: CRITICAL (Do Immediately)
1. Stop passing `ADMIN_KEYPAIR` via environment
   - Load from encrypted file or secret manager
   - Switch to file-based keypair for oracle-keeper
2. Remove hardcoded credentials from `.env`
   - Move to `.env.example` with placeholders
   - Add to `.gitignore`

### Phase 2: HIGH (Before Production)
1. Set `skipPreflight: false` for keeper transactions
   - Review all locations where `skipPreflight: true` appears
   - Add transaction simulation for critical operations
2. Add authorization middleware to all sensitive routes
3. Implement consistent Environment Variable validation at startup

### Phase 3: MEDIUM (Before Mainnet)
1. Audit all PublicKey inputs for curve and validity
2. Implement proper RPC endpoint failover with explicit configuration
3. Secure all keypair loading (devnet + mainnet)
4. Add structured error handling that doesn't leak PII

### Phase 4: LOW (Polish)
1. Clean up dead code (NETWORK checks that are always bypassed)
2. Document proxy configuration requirements
3. Add request logging sanitizer
4. Implement pre-commit secret scanning

---

## Files Requiring Changes

1. **bots/oracle-keeper/index.ts** - Keypair loading, Supabase queries
2. **.env** - Move test credentials or gitignore
3. **app/lib/api-auth.ts** - Validation fallback logic
4. **packages/shared/src/utils/solana.ts** - skipPreflight defaults
5. **app/app/api/\* routes** - PublicKey validation consistency
6. **app/lib/config.ts** - RPC fallback handling
7. Multiple test files - skipPreflight settings

---

## Testing Recommendations

1. **Integration Tests:** Verify all critical API routes require auth
2. **Key Rotation Tests:** Confirm keypair changes don't break keeper
3. **RPC Failover Tests:** Simulate API key unavailability
4. **Input Validation Tests:** Pass invalid PublicKeys to devnet endpoints
5. **Error Logging Audit:** Capture logs and scan for exposed secrets

---

## Conclusion

The codebase demonstrates good security awareness in some areas (timing-safe auth comparison, IP blocklists, admin verification), but has critical gaps in key management. The most urgent fix is removing private keys from environment variables. After that, the medium-severity RPC and validation gaps should be addressed before mainnet launch.

**Overall Security Posture:** Suitable for devnet testing; requires remediation before mainnet production use.
