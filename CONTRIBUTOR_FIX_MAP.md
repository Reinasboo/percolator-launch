# Contributor-Friendly Security Fixes for Percolator Launch

## Quick Summary
**Total Fixable as Contributor:** ~35 findings  
**Total Time Estimate:** 40-60 hours  
**Requires Special Access:** 4 findings (DB, infrastructure)

---

## Tier 1: Easy Wins (Can Start Now - 6-8 hours)

These require no database changes, no infrastructure access, and minimal coordination.

### ✅ 1.1 Create PublicKey Validation Helper
**File:** `app/lib/publickey.ts` (NEW)  
**Difficulty:** EASY | **Time:** 30 min | **Files Affected:** 1 new

**What to do:**
```typescript
// Create new helper for safe PublicKey parsing with clear error messages
// Use in: launch/route.ts, mobile/create-market/route.ts, trader route
```

**No blockers:** ✅ No dependencies, no special access needed

---

### ✅ 1.2 Fix Unsafe Type Casting (`as any`) - Core Batch
**Files:** 5 critical API routes  
**Difficulty:** MEDIUM | **Time:** 8-12 hours | **Impact:** HIGH

**Batch 1 Routes (Start with these):**
1. `app/app/api/devnet-airdrop/route.ts` - 12 instances
2. `app/app/api/markets/route.ts` - 8 instances
3. `app/app/api/applications/route.ts` - 2 instances
4. `app/app/api/airdrop/route.ts` - 4 instances
5. `app/app/api/auto-fund/route.ts` - 1 instance

**Strategy:**
- Don't need Supabase types to start (use `getServiceClient()` approach)
- Replace `(supabase as any)` with explicit type assertions
- Run `pnpm run build` after each file to verify

**Example:**
```typescript
// BEFORE:
const { data } = await (supabase as any).from("devnet_mints").select("*");

// AFTER (no types needed yet):
const { data, error } = await supabase
  .from('devnet_mints')
  .select('*');
```

**No blockers:** ✅ Pure code changes

---

### ✅ 1.3 Improve Error Handling - Add Explicit Error Responses
**Files:** All `app/app/api/**/*.ts` routes  
**Difficulty:** EASY | **Time:** 6-8 hours | **Impact:** HIGH

**What to fix:**
- Find all `catch` blocks
- Return proper HTTP status codes (502, 503, 400, etc)
- Don't fall through to empty responses

**Example:**
```typescript
// BEFORE:
try {
  return NextResponse.json(data);
} catch (err) {
  console.error(err); // Silent failure
  // Returns undefined
}

// AFTER:
try {
  return NextResponse.json(data);
} catch (err) {
  console.error('[route_context]', err);
  return NextResponse.json(
    { error: 'Service unavailable' },
    { status: 502 }
  );
}
```

**No blockers:** ✅ Code changes only

---

### ✅ 1.4 Add WebSocket Error Logging
**File:** `app/hooks/useLivePrice.ts`  
**Difficulty:** EASY | **Time:** 30 min

**Changes needed:**
- Line 1047: Replace `catch { /* ignore */ }` with meaningful error logging
- Add context to error messages

```typescript
// BEFORE:
try { localStorage.removeItem("percolator-pending-slab-keypair"); } 
catch { /* ignore */ }

// AFTER:
try { 
  localStorage.removeItem("percolator-pending-slab-keypair"); 
} catch (err) { 
  console.debug('[persist] Failed to clear pending keypair:', err); 
}
```

**No blockers:** ✅ Code changes only

---

## Tier 2: Medium Effort (2-3 weeks - 20-30 hours)

These require more coordination but no special access.

### ✅ 2.1 Complete Type Casting Fixes (Batch 2-5)
**Files:** Remaining 15+ API routes with `as any`  
**Difficulty:** MEDIUM | **Time:** 12-16 hours | **Impact:** HIGH

**Affected Routes:**
- `app/app/api/admin/bugs/route.ts` (2 instances)
- `app/app/api/devnet-mirror-mint/route.ts` (1 instance)
- `app/app/api/devnet-mint-token/route.ts` (multiple)
- `app/app/api/devnet-pre-fund/route.ts` (multiple)
- `app/app/api/faucet/route.ts` (multiple)
- ... and 10+ others

**Process:**
```bash
# Find all instances:
grep -r "as any" app/app/api --include="*.ts" | wc -l

# For each:
# 1. Open file
# 2. Understand the context
# 3. Replace with proper types/assertions
# 4. Test: pnpm run build
```

**No blockers:** ✅ Pure code refactoring

---

### ✅ 2.2 Add Null/Undefined Guards
**Files:** `app/app/api/devnet-pre-fund/route.ts` and others  
**Difficulty:** MEDIUM | **Time:** 3-4 hours

**What to fix:**
- Add explicit type guards before accessing properties
- Replace optional chaining with null checks where needed

```typescript
// BEFORE:
const { data: mirrorRow } = await supabase.from('...').select('*');
if (mirrorRow?.devnet_mint) { /* ... */ }

// AFTER:
if (!mirrorRow || typeof mirrorRow.devnet_mint !== 'string') {
  return NextResponse.json(
    { error: 'No mirror found' },
    { status: 400 }
  );
}
// Now safe to use mirrorRow.devnet_mint
```

**No blockers:** ✅ Code changes only

---

### ✅ 2.3 Create Structured Error Logger
**File:** `app/lib/error-logger.ts` (NEW)  
**Difficulty:** EASY | **Time:** 1-2 hours

**What to create:**
```typescript
// New utility for consistent error logging
// Usage: logError(err, { context: 'route_name', userId, requestId })
// Automatically logs to console + Sentry
```

**Then use throughout codebase:**
- Replace all ad-hoc error logging with `logError()`
- Ensure consistent format and Sentry reporting

**No blockers:** ✅ New file, no dependencies

---

### ✅ 2.4 Add JSDoc Documentation
**Files:** Complex functions in API routes  
**Difficulty:** EASY | **Time:** 3-4 hours

**Priority functions to document:**
1. `resolveServerOwnedDevnetMint()` - devnet-airdrop/route.ts
2. `getExistingMirror()` - devnet-airdrop/route.ts
3. `validateNumericParam()` - markets/route.ts
4. `isActiveMarket()` - markets/route.ts
5. `rawToUsd()` - markets/route.ts

**Template:**
```typescript
/**
 * Brief description
 * 
 * Detailed explanation of what happens
 * 
 * @param param1 - Description
 * @returns What is returned
 * @throws What errors it can throw
 * @example
 * const result = myFunction(value);
 */
function myFunction(param1: string): Promise<Result> {
  // ...
}
```

**No blockers:** ✅ Documentation only

---

### ✅ 2.5 Add Unit Tests for Validators
**Files:** `app/__tests__/lib/` and `app/__tests__/api/`  
**Difficulty:** MEDIUM | **Time:** 8-10 hours

**Tests to create:**

1. **PublicKey validation** (1-2 hours)
```typescript
// app/__tests__/lib/publickey.test.ts
describe('parsePublicKey', () => {
  it('accepts valid addresses');
  it('rejects invalid addresses');
  it('provides clear error messages');
  // ... etc
});
```

2. **Numeric parameter validation** (1-2 hours)
```typescript
// app/__tests__/api/numeric-validation.test.ts
describe('Numeric limits', () => {
  it('clamps limit to max');
  it('clamps limit to min');
  it('handles NaN');
  // ... etc
});
```

3. **Route error responses** (2-3 hours)
```typescript
// app/__tests__/api/error-handling.test.ts
describe('API error responses', () => {
  it('returns 400 for invalid input');
  it('returns 502 for service failures');
  // ... etc
});
```

4. **Race condition scenarios** (2-3 hours)
```typescript
// e2e/devnet-airdrop-race.spec.ts
test('concurrent requests from same wallet', () => {
  // Test devnet-airdrop handles race condition
});
```

**No blockers:** ✅ Test files, mocking only

---

## Tier 3: Requires Special Coordination (Infrastructure/Database)

**⚠️ These need database or infrastructure access** - but can coordinate the changes:

### 🔒 3.1 Add Database Constraint (REQUIRES DB ACCESS)
**File:** Database migration  
**Difficulty:** EASY | **Time:** 30 min (code), but needs DevOps to run

**What's needed:**
```sql
-- Someone with DB access needs to run:
ALTER TABLE public.devnet_mints 
ADD CONSTRAINT devnet_mints_mainnet_ca_creator_unique 
UNIQUE(mainnet_ca, creator);
```

**You can:**
- ✅ Write the SQL migration file
- ✅ Document why it's needed
- ✅ Get it reviewed by team
- ❌ Can't execute it yourself (needs admin)

**Where to put:**
- Create migration file in `supabase/migrations/` or similar
- Add comment documenting GH issue

---

### 🔒 3.2 Generate Supabase Types (REQUIRES SCHEMA ACCESS)
**File:** `app/lib/supabase.types.ts`  
**Difficulty:** EASY | **Time:** 1-2 hours

**What's needed:**
```bash
# Someone with DB access runs:
supabase gen types typescript --local > app/lib/supabase.types.ts
```

**You can:**
- ✅ Write a script to auto-generate types
- ✅ Document the process
- ✅ Integrate types into imports
- ❌ Can't query schema directly

**Alternative (as contributor):**
- Create manual type definitions based on schema docs
- Get reviewed by team who knows the schema

---

### 🔒 3.3 Verify Environment Configuration
**Files:** `.env`, `.env.example`  
**Difficulty:** EASY | **Time:** 1 hour

**What to do:**
- ✅ Document all required env vars in `.env.example`
- ✅ List which are production-critical
- ✅ Check if TRUSTED_PROXY_DEPTH is set correctly
- ❌ Can't set in production (needs admin)

**Example:**
```bash
# Add to .env.example with descriptions:
# Security - IP spoofing prevention (default: 1 for Vercel)
TRUSTED_PROXY_DEPTH=1

# WebSocket - Optional auth (default: false)
WS_AUTH_REQUIRED=false
WS_AUTH_SECRET=your-secret-here

# CORS - Production must be set explicitly
CORS_ORIGINS=https://yourapp.com,https://app.yourapp.com
```

---

### 🔒 3.4 Setup Sentry Error Monitoring (REQUIRES INFRA SETUP)
**Files:** None (configuration-based)  
**Difficulty:** EASY | **Time:** 2 hours

**You can:**
- ✅ Add error logging calls (`logError()`, `Sentry.captureException()`)
- ✅ Document error categories to monitor
- ✅ Create alert thresholds document
- ❌ Can't set up Sentry account/credentials

**Document:**
- Which errors to alert on
- Alert severity levels
- Escalation procedures

---

## Priority Checklist for Contributors

### Week 1 (Start Now - 6-8 hours)
- [ ] Create PublicKey validator `app/lib/publickey.ts`
- [ ] Fix unsafe type casting in 5 critical routes
- [ ] Add explicit error handling to all catch blocks
- [ ] Fix WebSocket error logging

**Effort:** ~8-10 hours | **Impact:** ~60% attack surface reduced

### Week 2 (10-12 hours)
- [ ] Continue type casting fixes (remaining 15+ routes)
- [ ] Add null/undefined guards
- [ ] Create error logger utility
- [ ] Start JSDoc documentation

**Effort:** ~10-12 hours | **Impact:** ~25% remaining issues

### Week 3 (8-10 hours)
- [ ] Complete JSDoc documentation
- [ ] Add unit tests for validators
- [ ] Add integration tests for race conditions
- [ ] PR review and iteration

**Effort:** ~8-10 hours | **Impact:** ~10% quality improvements + test coverage

### Optional (After Pressing Issues Fixed)
- [ ] Add request body size limits (low risk)
- [ ] Write migration SQL for DB constraint
- [ ] Document environment configuration
- [ ] Create Sentry monitoring checklist

---

## Git Workflow for Contributors

```bash
# Create feature branch for security fixes:
git checkout -b fix/security-audit-2026

# Work on fixes in priority order:
# 1. Commit PublicKey validator
git add app/lib/publickey.ts
git commit -m "feat: add PublicKey validation helper

- Ensures consistent formatting and error messages
- Fixes GH#XXXX (unsafe PublicKey operations)"

# 2. Commit type casting fixes per route
git add app/app/api/devnet-airdrop/route.ts
git commit -m "refactor: remove unsafe type casting in devnet-airdrop

- Replace 12 instances of 'as any' with proper types
- Improves IDE support and catches bugs at compile time
- Fixes GH#XXXX (unsafe type casting)"

# 3. Commit error handling
git add app/app/api/prices/route.ts app/app/api/markets/route.ts
git commit -m "fix: add explicit error responses in API routes

- Return 502 on service failure instead of empty response
- Properly handle and log all errors
- Fixes GH#XXXX (missing error handling)"

# Push when ready:
git push origin fix/security-audit-2026

# Create PR with link to audit findings
```

---

## What NOT to Do as Contributor

❌ **Don't touch database:**
- Don't create migrations without coordination
- Don't modify schema constraints

❌ **Don't change infrastructure:**
- Don't update .env in production
- Don't change deployment settings

❌ **Don't deploy without review:**
- All fixes must be PR reviewed
- Run tests locally first: `pnpm test`

❌ **Don't ignore build errors:**
- `pnpm run build` must pass
- After type casting fixes, verify TypeScript passes

---

## Testing Your Changes Locally

After each fix, run:

```bash
# Type check
pnpm run build

# Format check
pnpm format:check

# Unit tests (if you added them)
pnpm test:unit

# Linting
pnpm lint

# Manual smoke test of affected routes
```

---

## Files You'll Modify/Create

### New Files (Safe to Create)
- [ ] `app/lib/publickey.ts` - PublicKey validator
- [ ] `app/lib/error-logger.ts` - Error logging utility
- [ ] `app/__tests__/lib/publickey.test.ts` - PublicKey unit tests
- [ ] `app/__tests__/api/numeric-validation.test.ts` - Numeric validation tests
- [ ] `e2e/devnet-airdrop-race.spec.ts` - Race condition tests

### Files to Modify (Code Changes Only)
- [ ] `app/app/api/devnet-airdrop/route.ts` (12 type casts)
- [ ] `app/app/api/markets/route.ts` (8 type casts)
- [ ] `app/app/api/applications/route.ts` (2 type casts)
- [ ] `app/app/api/airdrop/route.ts` (4 type casts)
- [ ] `app/app/api/auto-fund/route.ts` (1 type cast)
- [ ] `app/hooks/useLivePrice.ts` (error logging)
- [ ] ... and 15+ other routes (type casts, error handling)

### Files to Discuss (Not Direct Changes)
- `.env.example` - Document required variables
- Migration files - Coordinate with DevOps
- Sentry configuration - Coordinate with infrastructure

---

## Questions to Ask Code Reviewers

When creating PRs, include:

1. **For type casting fixes:**
   - "Are there any cases where this type needs special handling?"
   - "Should we add types for batch operations?"

2. **For error handling:**
   - "Is the HTTP status code appropriate?"
   - "Should we log this error to Sentry?"

3. **For tests:**
   - "Are these edge cases sufficient?"
   - "Should we test more concurrency scenarios?"

---

## Success Metrics

After completing Tier 1 & 2:

- [ ] 0 instances of `as any` in core routes (devnet-airdrop, markets, etc)
- [ ] 100% of error paths return proper HTTP status codes
- [ ] All API error messages are descriptive (not generic)
- [ ] Unit test coverage ≥ 80% for modified files
- [ ] `pnpm run build` passes with zero TypeScript errors
- [ ] All PRs pass code review without security concerns

---

**Ready to start?** Begin with Tier 1 (PublicKey validator + type casting in 5 core routes). Estimated time: 8-10 hours for ~60% security improvement.

Reach out if anything is unclear!
