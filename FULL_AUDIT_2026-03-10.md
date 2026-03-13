# Full Codebase Audit Report
**Date**: March 10, 2026  
**Repository**: percolator-launch  
**Status**: Multiple Critical Issues Found

---

## 1. Dependency Security Audit (pnpm audit)

### Summary
- **Total Dependencies**: 1,554
- **Vulnerabilities Found**: 2 HIGH severity
- **Critical**: 0
- **Status**: ⚠️ REQUIRES IMMEDIATE ACTION

### Vulnerabilities Detailed

#### 1.1 bigint-buffer CVE-2025-3194
- **Severity**: HIGH (CVSS 7.5)
- **Affected Version**: ≤ 1.1.5
- **Vulnerability Type**: Buffer Overflow in toBigIntLE() function
- **Impact**: Application crash
- **Dependency Path**: `.>@solana/spl-token>@solana/buffer-layout-utils>bigint-buffer`
- **CWE**: CWE-120
- **Status**: ⚠️ NO PATCH AVAILABLE (patched_versions: <0.0.0)
- **Analysis**: This is a transitive dependency through @solana/spl-token. No patched version exists.

#### 1.2 @hono/node-server CVE-2026-29087
- **Severity**: HIGH (CVSS 7.5)
- **Affected Version**: < 1.19.10
- **Vulnerability Type**: Authorization bypass for protected static paths via encoded slashes
- **Impact**: Unauthenticated attackers can bypass route-based middleware protections
- **Dependency Path**: `packages/indexer>@hono/node-server`
- **CWE**: CWE-863 (Authorization Bypass)
- **Recommendation**: ✅ UPGRADE to version 1.19.10 or later
- **Status**: 🔴 ACTION REQUIRED

---

## 2. Code Formatting Audit (prettier --check)

### Summary
- **Files with Issues**: 77
- **Status**: ❌ FAILED
- **Action Required**: Run `pnpm format` to auto-fix

### Affected Files by Package
- **packages/api/src/** (2+ files)
- **packages/core/src/** (12+ files)
- **packages/indexer/src/** (5+ files)
- **packages/keeper/src/** (3+ files)
- **packages/shared/src/** (15+ files)

### Files Listed
```
[warn] packages/api/src/index.ts
[warn] packages/api/src/middleware/auth.ts
[warn] packages/api/src/middleware/cache.ts
[warn] packages/api/src/middleware/db-cache-fallback.ts
[warn] packages/api/src/middleware/ip-blocklist.ts
[warn] packages/api/src/middleware/rate-limit.ts
[warn] packages/api/src/middleware/sentry.ts
[warn] packages/api/src/middleware/validateSlab.ts
[warn] packages/api/src/routes/crank.ts
[warn] packages/api/src/routes/docs.ts
[warn] packages/api/src/routes/funding.ts
[warn] packages/api/src/routes/health.ts
[warn] packages/api/src/routes/insurance.ts
[warn] packages/api/src/routes/markets.ts
[warn] packages/api/src/routes/open-interest.ts
[warn] packages/api/src/routes/oracle-router.ts
[warn] packages/api/src/routes/prices.ts
[warn] packages/api/src/routes/stats.ts
[warn] packages/api/src/routes/trades.ts
[warn] packages/api/src/routes/ws.ts
[warn] packages/core/src/abi/accounts.ts
[warn] packages/core/src/abi/encode.ts
[warn] packages/core/src/abi/errors.ts
[warn] packages/core/src/abi/index.ts
[warn] packages/core/src/abi/instructions.ts
[warn] packages/core/src/config/program-ids.ts
[warn] packages/core/src/index.ts
[warn] packages/core/src/math/index.ts
[warn] packages/core/src/math/trading.ts
[warn] packages/core/src/math/warmup.ts
[warn] packages/core/src/oracle/price-router.ts
[warn] packages/core/src/runtime/index.ts
[warn] packages/core/src/runtime/tx.ts
[warn] packages/core/src/solana/__tests__/stake-cpi.test.ts
[warn] packages/core/src/solana/__tests__/stake.test.ts
[warn] packages/core/src/solana/ata.ts
[warn] packages/core/src/solana/dex-oracle.ts
[warn] packages/core/src/solana/discovery.ts
[warn] packages/core/src/solana/index.ts
[warn] packages/core/src/solana/oracle.ts
[warn] packages/core/src/solana/pda.ts
[warn] packages/core/src/solana/slab.ts
[warn] packages/core/src/solana/stake.ts
[warn] packages/core/src/solana/token-program.ts
[warn] packages/core/src/validation.ts
[warn] packages/indexer/src/index.ts
[warn] packages/indexer/src/routes/webhook.ts
[warn] packages/indexer/src/scripts/backfill-price-zero-trades.ts
[warn] packages/indexer/src/scripts/cleanup-corrupted-stats.ts
[warn] packages/indexer/src/services/HeliusWebhookManager.ts
[warn] packages/indexer/src/services/InsuranceLPService.ts
[warn] packages/indexer/src/services/MarketDiscovery.ts
[warn] packages/indexer/src/services/StatsCollector.ts
[warn] packages/indexer/src/services/TradeIndexer.ts
[warn] packages/keeper/src/env-guards.ts
[warn] packages/keeper/src/index.ts
[warn] packages/keeper/src/services/crank.ts
[warn] packages/keeper/src/services/liquidation.ts
[warn] packages/keeper/src/services/oracle.ts
[warn] packages/shared/src/alerts.ts
[warn] packages/shared/src/config.ts
[warn] packages/shared/src/db/client.ts
[warn] packages/shared/src/db/queries.ts
[warn] packages/shared/src/index.ts
[warn] packages/shared/src/logger.ts
[warn] packages/shared/src/monitor.ts
[warn] packages/shared/src/networkValidation.ts
[warn] packages/shared/src/retry.ts
[warn] packages/shared/src/sanitize.ts
[warn] packages/shared/src/sealedKeypair.ts
[warn] packages/shared/src/sentry.ts
[warn] packages/shared/src/services/events.ts
[warn] packages/shared/src/signer.ts
[warn] packages/shared/src/utils/binary.ts
[warn] packages/shared/src/utils/rpc-client.ts
[warn] packages/shared/src/utils/solana.ts
[warn] packages/shared/src/validation.ts
```

---

## 3. ESLint Linting Audit

### Summary
- **Status**: ❌ FAILED
- **Error Type**: Tooling Configuration Error
- **Root Cause**: ajv (JSON Schema validation) configuration issue in @eslint/eslintrc

### Error Details
```
NOT SUPPORTED: option missingRefs. Pass empty schema with $id that should be ignored to ajv.addSchema.

TypeError: Cannot set properties of undefined (setting 'defaultMeta')
    at ajvOrig (.../eslintrc.cjs:1626:27)
```

### Impact
- ESLint cannot run for code quality analysis
- This is a transitive dependency issue, not a code issue
- Affects: ESLint 8.57.1 + @eslint/eslintrc 2.1.4

### Remediation Options
1. Downgrade ESLint to 8.56.0 or earlier
2. Check for ESLint configuration conflicts
3. Review ajv overrides in pnpm workspace

---

## 4. Build Audit (Next.js @ percolator/app)

### Summary
- **Status**: ❌ FAILED
- **Error Type**: Missing Dependencies

### Build Errors
```
Turbopack build failed with 2 errors:

1. Module not found: Can't resolve '@upstash/ratelimit'
   File: ./app/lib/create-market-rate-limit.ts:13:1
   
2. Module not found: Can't resolve '@upstash/redis'
   File: ./app/lib/create-market-rate-limit.ts:12:1
```

### Analysis
- Both dependencies are declared in `app/package.json`:
  - `"@upstash/ratelimit": "^2.0.8"`
  - `"@upstash/redis": "^1.36.4"`
- Dependencies are not installed in node_modules
- Possible causes:
  1. `pnpm install` has not completed or failed
  2. Workspace hoisting issue
  3. Lockfile mismatch

### Remediation
1. Run `pnpm install --force` to ensure all dependencies are installed
2. Check pnpm-lock.yaml for consistency
3. Run `pnpm install --frozen-lockfile` in CI environments

---

## 5. Test Coverage Audit

### Summary
- **Status**: ⚠️ INCOMPLETE (Build prerequisite failed)
- **Reason**: Cannot run tests as build fails due to missing dependencies

### Next Steps After Build Fix
- Run `pnpm test:app --run` for app tests
- Run `pnpm test:core` for core/SDK tests
- Run `pnpm test:e2e` for end-to-end tests
- Run `pnpm test:coverage` for coverage metrics

---

## 6. Configuration Warnings

### Next.js Warnings
1. **Turbopack Root Ambiguity**
   - Multiple lockfiles detected at different levels
   - Recommended: Set `turbopack.root` in `next.config.ts`
   - Affects: Build performance and consistency

2. **Middleware Deprecation**
   - File: `app/middleware.ts`
   - Status: Deprecated convention, should use "proxy" instead
   - Reference: https://nextjs.org/docs/messages/middleware-to-proxy

3. **Sentry Deprecation Warnings**
   - `autoInstrumentServerFunctions` is deprecated
   - `disableLogger` is deprecated
   - Impact: Future version compatibility

---

## Summary & Action Items

### CRITICAL (Immediate Action Required)
- [ ] 🔴 Fix @hono/node-server - Upgrade to 1.19.10+ to fix authorization bypass vulnerability
- [ ] 🔴 Fix missing Upstash dependencies - Run `pnpm install --force` to resolve build errors

### HIGH (Address ASAP)
- [ ] ⚠️ bigint-buffer - Vulnerability with no patch available; evaluate risk and consider workarounds
- [ ] ⚠️ Fix ESLint configuration - Resolve ajv configuration issue to enable code linting
- [ ] ⚠️ Format codebase - Run `pnpm format` to fix 77 files with formatting issues

### MEDIUM (Planned)
- [ ] Migrate from deprecated middleware to proxy pattern
- [ ] Update Sentry configuration to use new options
- [ ] Set `turbopack.root` in Next.js config to resolve ambiguity

### LOW (Enhancement)
- [ ] Complete test coverage audit (after build fix)
- [ ] Review and expand test suite coverage
- [ ] Monitor for future ESLint and Sentry updates

---

## Audit Files Generated
- `pnpm_audit_2026-03-10.json` - Full dependency audit
- `format_audit_2026-03-10.txt` - Prettier formatting issues
- `build_audit_2026-03-10.txt` - Next.js build errors
- `FULL_AUDIT_2026-03-10.md` - This comprehensive report

---

**Report Generated**: 2026-03-10  
**Auditor**: GitHub Copilot Automated Audit System  
**Next Review**: After critical issues are resolved
