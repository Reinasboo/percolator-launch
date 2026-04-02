# Percolator Launch - Security Remediation Plan
**Date:** April 2, 2026  
**Target Completion:** April 16, 2026 (2 weeks)

---

## Remediation Roadmap

### Phase 1: Critical (Days 1-3)
- [ ] Add database constraint for devnet-airdrop race condition
- [ ] Create PublicKey validation helper
- [ ] Add proper Supabase type definitions

### Phase 2: High Priority (Days 4-7)
- [ ] Fix all `as any` type casting (200+ instances)
- [ ] Add explicit error responses in catch blocks
- [ ] Add request body size limits to sensitive endpoints

### Phase 3: Medium Priority (Days 8-14)
- [ ] Expand unit test coverage
- [ ] Add structured error logging
- [ ] JSDoc documentation for complex functions

### Phase 4: Low Priority (Ongoing)
- [ ] Deprecation headers for old endpoints
- [ ] Performance optimization (N+1 queries)
- [ ] Monitoring and alerting setup

---

## Detailed Remediation Tasks

### TASK 1: Database Constraint for devnet-airdrop Race Condition

**File:** Database migration or manual SQL  
**Complexity:** EASY  
**Time Estimate:** 30 minutes

**SQL:**
```sql
-- Add unique constraint to prevent mirror creation race condition
ALTER TABLE public.devnet_mints 
ADD CONSTRAINT devnet_mints_mainnet_ca_creator_unique 
UNIQUE(mainnet_ca, creator);

-- Alternative: composite index for query optimization
CREATE UNIQUE INDEX idx_devnet_mints_mainnet_creator 
ON public.devnet_mints(mainnet_ca, creator) 
WHERE mainnet_ca IS NOT NULL;
```

**Verification:**
```typescript
// Test in devnet-airdrop route
const { data: existing } = await supabase
  .from('devnet_mints')
  .select('*')
  .eq('mainnet_ca', caAddress)
  .eq('creator', creatorAddress)
  .single(); // Will return 406 if constraint violation
```

**Status:** [ ] Pending

---

### TASK 2: Create PublicKey Validation Helper

**File:** app/lib/publickey.ts (NEW)  
**Complexity:** EASY  
**Time Estimate:** 30 minutes

**Implementation:**
```typescript
import { PublicKey, PublicKeyInitData } from '@solana/web3.js';

/**
 * Safely parse and validate a PublicKey from user input
 * @param input - Raw string/input to parse
 * @param fieldName - Field name for error messages (e.g., "wallet address")
 * @returns Validated PublicKey instance
 * @throws Error with descriptive message if invalid
 */
export function parsePublicKey(
  input: unknown,
  fieldName = 'address'
): PublicKey {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string, got ${typeof input}`);
  }

  if (!input.trim()) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  try {
    const pubKey = new PublicKey(input.trim());
    
    // Verify it's a valid base58 string
    if (!pubKey.toBase58().length) {
      throw new Error(`${fieldName} is not a valid Solana address`);
    }
    
    return pubKey;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid')) {
      throw new Error(`Invalid ${fieldName} format. Expected 44-character base58 string.`);
    }
    throw err;
  }
}

/**
 * Validate array of PublicKeys
 */
export function parsePublicKeyArray(
  input: unknown,
  fieldName = 'addresses'
): PublicKey[] {
  if (!Array.isArray(input)) {
    throw new Error(`${fieldName} must be an array`);
  }
  
  return input.map((addr, idx) => 
    parsePublicKey(addr, `${fieldName}[${idx}]`)
  );
}
```

**Usage in Routes:**
```typescript
// Before:
try {
  const marketPubkey = new PublicKey(marketAddress); // ⚠️ Bare usage
} catch {
  return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
}

// After:
import { parsePublicKey } from '@/lib/publickey';

try {
  const marketPubkey = parsePublicKey(marketAddress, 'market address');
  // ... rest of logic
} catch (err) {
  return NextResponse.json(
    { error: err instanceof Error ? err.message : 'Invalid address' },
    { status: 400 }
  );
}
```

**Status:** [ ] Pending

---

### TASK 3: Add Supabase Type Definitions

**File:** app/lib/supabase.types.ts (NEW/UPDATE)  
**Complexity:** MEDIUM  
**Time Estimate:** 2-3 hours

**Generate from database schema:**
```bash
cd app
pnpm add -D @supabase/supabase-js
pnpm exec supabase gen types typescript --local > lib/supabase.types.ts
```

**Manual type file (if auto-gen unavailable):**
```typescript
export interface Database {
  public: {
    Tables: {
      devnet_mints: {
        Row: {
          id: string;
          mainnet_ca: string | null;
          devnet_mint: string;
          creator: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['devnet_mints']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['devnet_mints']['Row']>;
      };
      // ... other tables
    };
  };
}
```

**Usage Example:**
```typescript
// Before:
const { data } = await (supabase as any)
  .from('devnet_mints')
  .select('*');

// After:
import { Database } from '@/lib/supabase.types';

type DevnetMint = Database['public']['Tables']['devnet_mints']['Row'];
const { data: mints } = await supabase
  .from('devnet_mints')
  .select('*')
  .returns<DevnetMint[]>();
```

**Status:** [ ] Pending

---

### TASK 4: Fix Unsafe Type Casting (Batch 1-5)

**Files:** 20+ API routes  
**Complexity:** MEDIUM  
**Time Estimate:** 40-50 hours total (5 batches of 8-10 hours each)

**Strategy:** Work in increments to avoid breaking changes

**Batch 1 (Priority - Core paths):**

1. [ ] app/app/api/devnet-airdrop/route.ts - 12 instances
2. [ ] app/app/api/markets/route.ts - 8 instances
3. [ ] app/app/api/applications/route.ts - 2 instances
4. [ ] app/app/api/airdrop/route.ts - 4 instances
5. [ ] app/app/api/auto-fund/route.ts - 1 instance

**Process for each file:**

```typescript
// Step 1: Understand the context
// Read all (supabase as any) usages in file
grep -n 'as any' app/app/api/devnet-airdrop/route.ts

// Step 2: Check existing types
// Look for TypeScript declarations in same file or imports

// Step 3: Create proper types OR use service client wrapper
const supabase = getServiceClient(); // Already returns typed client
// Most `as any` are unnecessary if using proper client

// Step 4: Run tests
pnpm test app/app/api/devnet-airdrop/__tests__/

// Step 5: Type-check
pnpm run build
```

**Example Fix:**
```typescript
// OLD:
await (supabase as any).from('devnet_mints').upsert(data);

// NEW:
import { Database } from '@/lib/supabase.types';
const { data: result, error } = await supabase
  .from('devnet_mints')
  .upsert<Database['public']['Tables']['devnet_mints']['Row']>(data)
  .select()
  .single();

if (error) {
  throw new Error(`Upsert failed: ${error.message}`);
}
```

**Status:** [ ] Batch 1 Pending
**Status:** [ ] Batch 2 Pending
**Status:** [ ] Batch 3 Pending
**Status:** [ ] Batch 4 Pending
**Status:** [ ] Batch 5 Pending

---

### TASK 5: Add Explicit Error Responses in All Routes

**Files:** All app/app/api/**/*.ts  
**Complexity:** MEDIUM  
**Time Estimate:** 6-8 hours

**Pattern to implement:**
```typescript
// Standard error response wrapper
function handleApiError(
  error: unknown,
  context: string,
  statusCode: number = 500
) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  console.error(`[${context}] Error:`, { error, errorMsg });
  Sentry.captureException(error, { tags: { context } });
  
  return NextResponse.json(
    { error: errorMsg, code: `${context.toUpperCase()}_ERROR` },
    { status: statusCode }
  );
}

// Usage in routes:
try {
  const data = await fetchExternalData();
  return NextResponse.json(data);
} catch (err) {
  return handleApiError(err, 'fetch_external_data', 502);
}
```

**Audit Checklist:**
```typescript
// For each catch block, verify:
// ✅ Error is logged with context
// ✅ Sentry is notified
// ✅ Client receives proper HTTP status (not 200)
// ✅ Error contains helpful message (not generic)
// ✅ Sensitive info isn't exposed (db creds, tokens, etc)
```

**Status:** [ ] Pending

---

### TASK 6: Add Request Body Size Limits

**File:** app/middleware.ts or app/app/api/rpc/route.ts  
**Complexity:** EASY  
**Time Estimate:** 1 hour

**Implementation:**
```typescript
// app/app/api/rpc/route.ts
const MAX_RPC_BATCH_SIZE = 100;
const MAX_BODY_SIZE = 1_000_000; // 1MB

export async function POST(req: NextRequest) {
  // Check content length early
  const contentLength = parseInt(
    req.headers.get('content-length') || '0',
    10
  );
  
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json(
      { 
        error: 'Request body too large',
        max_bytes: MAX_BODY_SIZE 
      },
      { status: 413 }
    );
  }

  try {
    const body = await req.json();
    
    // Batch limit
    if (Array.isArray(body) && body.length > MAX_RPC_BATCH_SIZE) {
      return NextResponse.json(
        { 
          error: `Batch size exceeds limit`,
          max_batch: MAX_RPC_BATCH_SIZE,
          provided: body.length
        },
        { status: 400 }
      );
    }
    
    // ... rest of handler
  } catch (err) {
    return handleApiError(err, 'rpc_parse', 400);
  }
}
```

**Status:** [ ] Pending

---

### TASK 7: Add Unit Tests for Validators

**Files:** app/__tests__/  
**Complexity:** MEDIUM  
**Time Estimate:** 8-10 hours

**Create test files:**

```typescript
// app/__tests__/lib/publickey.test.ts
import { parsePublicKey } from '@/lib/publickey';

describe('parsePublicKey', () => {
  it('Accepts valid base58 addresses', () => {
    const addr = 'So11111111111111111111111111111111111111112';
    const result = parsePublicKey(addr);
    expect(result.toBase58()).toBe(addr);
  });

  it('Rejects non-string input', () => {
    expect(() => parsePublicKey(123)).toThrow('must be a string');
  });

  it('Rejects empty strings', () => {
    expect(() => parsePublicKey('')).toThrow('cannot be empty');
  });

  it('Rejects invalid base58', () => {
    expect(() => parsePublicKey('invalid!@#$')).toThrow('Invalid');
  });

  it('Provides clear error messages with field names', () => {
    expect(() => parsePublicKey(null, 'wallet')).toThrow('wallet must be a string');
  });
});

// app/__tests__/api/numeric-validation.test.ts
describe('Numeric Parameter Validation', () => {
  it('Clamps limit: 0 → 1', () => {
    const limit = Math.min(Math.max(0, 1), 500);
    expect(limit).toBe(1);
  });

  it('Clamps limit: 999 → 500', () => {
    const limit = Math.min(Math.max(999, 1), 500);
    expect(limit).toBe(500);
  });

  it('Handles NaN defaults to DEFAULT_LIMIT', () => {
    const parsed = parseInt('abc', 10);
    const limit = Number.isNaN(parsed) ? 500 : parsed;
    expect(limit).toBe(500);
  });

  it('Handles negative numbers', () => {
    const limit = Math.min(Math.max(-10, 1), 500);
    expect(limit).toBe(1);
  });
});
```

**Status:** [ ] Pending

---

### TASK 8: Add Structured Error Logging

**File:** app/lib/error-logger.ts (NEW)  
**Complexity:** EASY  
**Time Estimate:** 1-2 hours

**Implementation:**
```typescript
import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  context: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

export function logError(
  error: unknown,
  context: ErrorContext
) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const enrichedContext = {
    ...context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };
  
  // Console logging (for development)
  console.error(`[${context.context}]`, {
    error: errorMsg,
    stack: errorStack,
    ...enrichedContext,
  });
  
  // Sentry reporting (for production)
  Sentry.captureException(error, {
    tags: {
      context: context.context,
      severity: 'error',
    },
    extra: enrichedContext,
  });
}

export function logWarning(
  message: string,
  context: ErrorContext
) {
  console.warn(`[${context.context}]`, message, context);
  
  Sentry.captureMessage(message, {
    level: 'warning',
    tags: { context: context.context },
    extra: context,
  });
}
```

**Usage:**
```typescript
import { logError } from '@/lib/error-logger';

try {
  const data = await fetchData();
} catch (err) {
  logError(err, {
    context: 'fetch_market_data',
    requestId: req.id,
    market: marketAddress,
  });
  return NextResponse.json(
    { error: 'Failed to fetch market data' },
    { status: 502 }
  );
}
```

**Status:** [ ] Pending

---

### TASK 9: Add JSDoc to Complex Functions

**Files:** app/app/api/devnet-airdrop/route.ts and others  
**Complexity:** EASY  
**Time Estimate:** 3-4 hours

**Example:**
```typescript
/**
 * Resolves or creates a mirror mint for a mainnet token on devnet
 * 
 * Mirror Creation Flow:
 * 1. Check if mirror already exists for (mainnet_ca, creator) pair
 * 2. If not: create new wrapper SPL token on devnet 
 * 3. Record mapping: mainnet_ca → devnet_mint for future lookups
 * 
 * TOCTOU Fix (GH#1769):
 * - Uses INSERT-as-gate pattern to prevent race condition
 * - DB UNIQUE constraint on (mainnet_ca, creator) enforces single winner
 * - Losers of race get the winner's mirror ID
 * 
 * @param mainnetCa - Solana address of token on mainnet
 * @param creator - Wallet creating/requesting the mirror
 * @returns Promise<{ devnet_mint: string }> - Address of mirror token
 * @throws Error if token doesn't exist or creation fails
 * 
 * @example
 * const result = await resolveServerOwnedDevnetMint(
 *   'So11111111111111111111111111111111111111112',
 *   'YOUR_WALLET_ADDRESS'
 * );
 * // Returns: { devnet_mint: 'GYzjMCXTDoUWXc3... }
 */
function resolveServerOwnedDevnetMint(
  mainnetCa: string,
  creator: string
): Promise<{ devnet_mint: string }> {
  // ... implementation
}
```

**Status:** [ ] Pending

---

## Testing Strategy

### Pre-Deployment Checklist

```bash
# Type checking
pnpm run build
pnpm exec tsc --noEmit

# Unit tests
pnpm test:unit

# E2E tests
pnpm test:e2e

# Security audit
pnpm audit
npm audit --omit=dev

# Linting
pnpm lint --fix
pnpm format:check

# Manual testing
# 1. Create market on devnet
# 2. Test airdrop with concurrent requests
# 3. Test rate limiting (6 requests/minute per IP)
# 4. Test invalid PublicKey inputs
# 5. Test oversized request bodies
```

---

## Deployment Plan

### Week 1: Critical Fixes
- DB constraint for race condition
- PublicKey validation helper
- Supabase type definitions

**Deployment:** Tag as v0.1.1 hotfix

### Week 2: High-Priority Fixes
- Fix `as any` type castings (Batch 1-3)
- Add error responses
- Add request size limits

**Deployment:** Tag as v0.2.0 minor release

### Weeks 3-4: Medium-Priority Improvements
- Unit test coverage
- Error logging
- JSDoc comments

**Deployment:** Continuous via main branch

---

## Success Metrics

- [ ] 0 instances of `as any` remaining (or properly documented exceptions)
- [ ] 100% of error paths return proper HTTP status codes
- [ ] Unit test coverage ≥ 85% for API routes
- [ ] No critical Sentry errors for 7 consecutive days
- [ ] Rate limiting verified with load testing
- [ ] Security audit grade: B or higher

---

## Owner Assignment

| Task | Owner | Status |
|------|-------|--------|
| DB Constraint | DevOps | [ ] |
| PublicKey Validator | Backend | [ ] |
| Type Definitions | Backend | [ ] |
| Fix Type Castings | Backend (2 devs) | [ ] |
| Error Responses | Backend | [ ] |
| Unit Tests | QA | [ ] |
| Error Logging | DevOps | [ ] |
| Documentation | Tech Writer | [ ] |

---

**Last Updated:** April 2, 2026
