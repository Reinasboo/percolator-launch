# Quick Start: Security Fixes for Contributors

## What You Can Fix Today (6-8 hours to 60% improvement)

### Option A: The 4-Hour Power Hour
Perfect if you have a few hours this afternoon:

- [ ] **30 min:** Create `app/lib/publickey.ts` - PublicKey validation helper
- [ ] **30 min:** Fix `app/app/api/airdrop/route.ts` - Remove 4 `as any` casts
- [ ] **1 hour:** Fix `app/app/api/applications/route.ts` - Remove 2 `as any` casts  
- [ ] **1 hour:** Fix error handling in `app/app/api/prices/route.ts` and `app/app/api/markets/route.ts`
- [ ] **30 min:** Add error logging in `app/hooks/useLivePrice.ts`
- [ ] **1 hour:** Test and verify builds pass
- [ ] **30 min:** Create PR

**Total:** ~5 hours | **High-Impact:** YES

---

### Option B: The Deep Dive (8-12 hours this week)
If you can dedicate a day or two:

**Day 1 (4-5 hours):**
- [ ] Create PublicKey validator (30 min)
- [ ] Fix all type casting in 5 critical routes (3-4 hours)
- [ ] Test (30 min)

**Day 2 (3-4 hours):**
- [ ] Add explicit error responses in all routes (2-3 hours)
- [ ] Add WebSocket error logging (30 min)
- [ ] Test and create PR (30 min)

**Total:** ~8 hours | **High-Impact:** 60% of security issues fixed

---

## The Exact Files to Edit (Copy-Paste Ready)

### File 1: Create New → `app/lib/publickey.ts`

```typescript
import { PublicKey } from '@solana/web3.js';

/**
 * Safely parse and validate a PublicKey from user input
 * @param input - Raw string to parse
 * @param fieldName - Field name for error messages
 * @throws Error with descriptive message if invalid
 */
export function parsePublicKey(
  input: unknown,
  fieldName = 'address'
): PublicKey {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string, got ${typeof input}`);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  try {
    const pubKey = new PublicKey(trimmed);
    return pubKey;
  } catch (err) {
    throw new Error(
      `Invalid ${fieldName}. Expected 44-character base58 Solana address, got: ${trimmed.substring(0, 20)}...`
    );
  }
}
```

✅ **Done!** Now search for `new PublicKey(` in your routes and use this instead.

---

### File 2: Fix → `app/app/api/airdrop/route.ts`

**Search for all:** `as any`

**Replace these lines:**
```typescript
// Line 309 - BEFORE:
const { data: marketData } = await (supabase as any)
  .from('markets')
  .select('*');

// AFTER:
const { data: marketData, error } = await supabase
  .from('markets')
  .select('*');

// Line 322 - BEFORE:
const { data: devnetMintData, error: fallbackErr } = await (supabase as any)
  .from('devnet_mints')
  .select('*');

// AFTER:
const { data: devnetMintData, error: fallbackErr } = await supabase
  .from('devnet_mints')
  .select('*');

// Line 348 & 477 - Same pattern: remove `as any`
```

✅ **Done!** Run `pnpm run build` to verify.

---

### File 3: Fix → `app/app/api/applications/route.ts`

**Find and replace (2 instances):**

```typescript
// Line 37 - BEFORE:
const { data, error } = await (sb.from as any)("job_applications")
  .select('*');

// AFTER:
const { data, error } = await sb
  .from('job_applications')
  .select('*');

// Line 116 - BEFORE:
const { error } = await (sb.from as any)(TABLE).insert({...});

// AFTER:
const { error } = await sb
  .from(TABLE)
  .insert({...});
```

✅ **Done!** Only 2 changes, very quick.

---

### File 4: Fix → `app/app/api/auto-fund/route.ts`

**Find and replace (1 instance):**

```typescript
// Line 183 - BEFORE:
await (supabase as any).from("auto_fund_log").insert({
  wallet,
  timestamp: new Date(),
  status: 'success'
});

// AFTER:
await supabase
  .from("auto_fund_log")
  .insert({
    wallet,
    timestamp: new Date(),
    status: 'success'
  });
```

✅ **Done!** Simplest fix.

---

### File 5: Fix → `app/hooks/useLivePrice.ts`

**Find (line ~1047):**
```typescript
try { localStorage.removeItem("percolator-pending-slab-keypair"); } catch { /* ignore */ }
```

**Replace with:**
```typescript
try { 
  localStorage.removeItem("percolator-pending-slab-keypair"); 
} catch (err) { 
  console.debug('[useLivePrice] Failed to clear pending keypair:', err); 
}
```

✅ **Done!** Better error visibility.

---

### File 6: Fix → `app/app/api/prices/route.ts`

**Find the catch block (around line 84-95):**

```typescript
// BEFORE:
try {
  const prices = await fetch(pythOracleUrl, {...});
  const data = await prices.json();
  return NextResponse.json(data);
} catch (err) {
  Sentry.captureException(err);
  // Missing explicit error response!
}

// AFTER:
try {
  const prices = await fetch(pythOracleUrl, {...});
  const data = await prices.json();
  return NextResponse.json(data);
} catch (err) {
  console.error('[/api/prices] Fetch failed:', err);
  Sentry.captureException(err);
  return NextResponse.json(
    { error: 'Failed to fetch prices from oracle' },
    { status: 502 }
  );
}
```

✅ **Done!** Now returns proper 502 error.

---

### File 7: Fix → `app/app/api/markets/route.ts`

**Find all catch blocks** (multiple instances) and add error responses.

**Example pattern (find similar ones):**

```typescript
// BEFORE:
try {
  const markets = await getMarketStats();
  return NextResponse.json({ markets });
} catch (err) {
  console.error(err);
  // Returns undefined
}

// AFTER:
try {
  const markets = await getMarketStats();
  return NextResponse.json({ markets });
} catch (err) {
  console.error('[/api/markets] Failed to get stats:', err);
  Sentry.captureException(err);
  return NextResponse.json(
    { error: 'Failed to fetch market statistics' },
    { status: 502 }
  );
}
```

✅ **Done!** Consistent error handling throughout.

---

## Testing Your Changes

After each file, run:

```bash
# Quick build check
pnpm run build

# If build passes, you're good!
# If TypeScript errors, fix them and re-run
```

---

## Creating Your PR

Once all files are fixed:

```bash
# 1. Create a branch
git checkout -b fix/security-audit-contributor

# 2. Add all changes
git add app/lib/publickey.ts app/app/api/**/*.ts app/hooks/**/*.ts

# 3. Commit with clear message
git commit -m "fix: address security audit findings (2026-04-02)

- Remove unsafe type casting (as any) from core routes
- Add explicit error handling to all API endpoints
- Create PublicKey validation helper for safer parsing
- Add logging to error handling in WebSocket hooks

Fixes findings from SECURITY_AUDIT_REPORT_2026_04_02.md
"

# 4. Push
git push origin fix/security-audit-contributor

# 5. Open PR on GitHub with description:
# - Link to CONTRIBUTOR_FIX_MAP.md
# - Link to SECURITY_AUDIT_REPORT_2026_04_02.md
# - Testing notes (all tests pass, builds clean, etc)
```

---

## Still Not Sure? Here's The Absolute Minimum

**If you only have 1-2 hours:**

Do JUST this 30-minute task:

```bash
# Create PublicKey validator
cat > app/lib/publickey.ts << 'EOF'
import { PublicKey } from '@solana/web3.js';

export function parsePublicKey(input: unknown, fieldName = 'address'): PublicKey {
  if (typeof input !== 'string') throw new Error(`${fieldName} must be a string`);
  if (!input.trim()) throw new Error(`${fieldName} cannot be empty`);
  try {
    return new PublicKey(input.trim());
  } catch {
    throw new Error(`Invalid ${fieldName} format`);
  }
}
EOF

git add app/lib/publickey.ts
git commit -m "feat: add PublicKey validation helper"
git push origin fix/security-contributor
```

**Why?** This is:
- ✅ Quick to implement
- ✅ No dependencies
- ✅ Immediately useful
- ✅ Good first contribution
- ✅ Shows you understand the audit

---

## Get Help

**Questions?**
- Read `SECURITY_AUDIT_REPORT_2026_04_02.md` (detailed explanation)
- Read `CONTRIBUTOR_FIX_MAP.md` (complete roadmap)
- Ask in PR comments, team slack, etc

**Stuck on build errors?**
- Run `pnpm run build` to see TypeScript errors
- Most common: you removed `as any` but need to import type
- Solution: Add proper imports at top of file

---

## Success = This Command Works

```bash
pnpm run build
# Should output: ✅ tsc build succeeded
```

That's it. Submit your PR and celebrate! 🎉

---

**Estimated Time:** 4-6 hours for significant security impact  
**Difficulty:** Easy to Medium  
**No Special Access:** ✅ All code changes, no infrastructure needed
