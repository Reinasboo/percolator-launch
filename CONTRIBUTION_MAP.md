# Percolator Launch - Safe Contribution Map

**Strategy**: Enhance code quality, maintainability, and test coverage without modifying any core features or existing functionality.

---

## Contribution Overview

| # | Title | Scope | Impact | Risk | Status |
|---|-------|-------|--------|------|--------|
| 1 | **Type Safety in Error Handling** | packages/shared, packages/keeper, packages/api | Improve type safety across service layers | Very Low | Planned |
| 2 | **JSDoc Documentation Blitz** | app/lib/*, packages/*/src | Add comprehensive documentation | Very Low | Planned |
| 3 | **Utility Function Test Suite** | app/lib, packages/shared/src/utils | Unit tests for pure functions | Very Low | Planned |
| 4 | **Structured Logging Helpers** | packages/shared | New optional logging utilities | Very Low | Planned |
| 5 | **Error Message Improvements** | app/lib, packages/shared | Better user-facing error messages | Very Low | Planned |

---

## Contribution 1: Type Safety in Error Handling

**Branch**: `feat/error-type-safety`  
**Files Modified**: 8-10 files  
**Type**: Enhancement  
**Breaking Changes**: None

### Scope

Add type-safe error handling patterns to reduce `unknown` type usage and improve error context tracking.

### Changes

1. **packages/shared/src/errors.ts** (NEW)
   - Create `ApiError` interface with status, code, message, context
   - Create `ValidationError` interface
   - Create helper functions: `isApiError()`, `isValidationError()`, `getErrorMessage()`
   - Type guards for common error patterns

2. **packages/shared/src/utils/solana.ts** (MODIFY)
   - Replace `unknown` type in catch blocks with specific error types
   - Use new error type guards
   - Add proper error propagation with context

3. **packages/api/src/middleware/auth.ts** (MODIFY)
   - Replace `unknown` with typed errors
   - Add request context to errors

4. **packages/keeper/src/services/oracle.ts** (MODIFY)
   - Add proper error typing in catch blocks
   - Improve error context in logger calls

5. **packages/keeper/src/services/liquidation.ts** (MODIFY)
   - Add proper error typing in catch blocks

### Why It's Safe

- ✅ No functional changes - only improving type information
- ✅ Backward compatible - new types don't break existing code
- ✅ Pure abstraction layer - no behavior changes
- ✅ Well-tested areas - will use existing test suite

### Testing

```bash
# Existing tests should all pass
pnpm test:unit
```

### PR Description Keywords
- `type-safety`, `error-handling`, `typescript`, `improvement`, `non-breaking`

---

## Contribution 2: Comprehensive JSDoc Documentation

**Branch**: `docs/jsdoc-added-for-lib-utils`  
**Files Modified**: 12-15 files  
**Type**: Documentation  
**Breaking Changes**: None

### Scope

Add JSDoc comments to utility functions across application/shared library that currently lack documentation.

### Changes

1. **app/lib/errorMessages.ts**
   - Document each error message constant
   - Add JSDoc with examples and use cases

2. **app/lib/format.ts**
   - Document formatting functions with parameter types and return examples
   - Add usage examples in JSDoc

3. **app/lib/formatters.ts**
   - Document number formatters (compact, percentage, currency)
   - Add JSDoc with input/output examples

4. **app/lib/parseAmount.ts**
   - Document amount parser with decimal handling
   - Add examples of parsing edge cases

5. **app/lib/symbol-utils.ts**
   - Document symbol validation and parsing utilities
   - Add examples of valid/invalid symbols

6. **app/lib/dex-constants.ts**
   - Document DEX configuration constants
   - Add JSDoc explaining each constant's purpose

7. **app/lib/wallets.ts**
   - Document wallet validation helpers
   - Add examples of address validation

8. **packages/shared/src/utils/binary.ts**
   - Document binary parsing utilities
   - Add examples of U128 parsing

### Why It's Safe

- ✅ Pure documentation - no code changes
- ✅ Comments only - zero functional impact
- ✅ Non-breaking - doesn't affect existing code
- ✅ Improves IDE/documentation generation

### Testing

```bash
# No new tests needed - documentation only
# Existing tests should pass without modification
pnpm lint  # TypeScript check still works
```

### PR Description Keywords
- `documentation`, `jsdoc`, `improvement`, `developer-experience`

---

## Contribution 3: Utility Function Test Suite

**Branch**: `test/add-util-tests-for-lib-functions`  
**Files Added**: 5-7 new test files  
**Type**: Testing  
**Breaking Changes**: None

### Scope

Add comprehensive unit tests for pure utility functions in app/lib that currently have zero test coverage.

### New Test Files

1. **app/__tests__/lib/errorMessages.test.ts**
   - Test that all error messages are valid strings
   - Test error message access
   - Verify no messages are empty or undefined

2. **app/__tests__/lib/format.test.ts**
   - Test number formatting edge cases
   - Test empty/null input handling
   - Test format consistency

3. **app/__tests__/lib/parseAmount.test.ts**
   - Test amount parsing with various decimals
   - Test edge cases (0, max values, invalid input)
   - Test decimal normalization

4. **app/__tests__/lib/symbol-utils.test.ts**
   - Test symbol validation
   - Test valid/invalid symbol patterns
   - Test symbol normalization

5. **app/__tests__/lib/dex-constants.test.ts**
   - Test all DEX constants are properly defined
   - Test constant value types and ranges
   - Test constants availability

### Test Coverage

Each test file will verify:
- ✅ Function exports are correct
- ✅ Edge case handling (null, undefined, empty)
- ✅ Type correctness (return values match expected)
- ✅ Error scenarios are handled appropriately

### Why It's Safe

- ✅ Pure unit tests - no feature changes
- ✅ Tests pure functions - no side effects
- ✅ Zero dependencies on business logic
- ✅ Non-breaking - only adds tests

### Testing

```bash
# Run new tests
pnpm test:app

# Verify no regressions
pnpm test
```

### PR Description Keywords
- `tests`, `coverage`, `utility-functions`, `quality-assurance`

---

## Contribution 4: Structured Logging Helpers

**Branch**: `feat/logging-helpers`  
**Files Added**: 1-2 new files  
**Type**: Enhancement  
**Breaking Changes**: None

### Scope

Create optional structured logging helper functions to standardize logging patterns across services.

### Changes

1. **packages/shared/src/logHelpers.ts** (NEW)
   - `logError()`: Log error with context and error details
   - `logApiCall()`: Log API calls with method, path, status
   - `logDbQuery()`: Log database queries with timing
   - `logOperation()`: Log long-running operations with timestamps
   - Export as optional utilities (existing logger still works)

2. **packages/shared/src/index.ts** (MODIFY)
   - Add exports for new log helpers
   - Keep existing logger exports unchanged

### Implementation Pattern

```typescript
// Optional usage pattern (doesn't break existing code)
logger.info("message", context);  // Still works
logApiCall(logger, method, path, status, duration);  // New optional pattern
```

### Why It's Safe

- ✅ Optional helpers - existing logging still works
- ✅ Non-breaking export - only adds new exports
- ✅ Pure utility functions
- ✅ No changes to existing logger interface

### Testing

```bash
# New unit tests for helpers
pnpm --filter @percolator/shared test

# Verify existing tests still pass
pnpm test
```

### PR Description Keywords
- `logging`, `helpers`, `observability`, `improvement`

---

## Contribution 5: Error Message Improvements

**Branch**: `improve/error-messages-context`  
**Files Modified**: 5-7 files  
**Type**: Enhancement  
**Breaking Changes**: None

### Scope

Enhance error messages with better context and clarity without modifying error handling logic.

### Changes

1. **app/lib/errorMessages.ts** (MODIFY)
   - Add new error message constants for common scenarios
   - Improve existing message clarity
   - Add error codes for tracking

2. **packages/shared/src/utils/solana.ts** (MODIFY)
   - Use improved error messages
   - Add context to thrown errors
   - Better TX failure messages

3. **packages/api/src/middleware/validateSlab.ts** (MODIFY)
   - Add helpful error messages for invalid addresses
   - Include format suggestions

4. **packages/keeper/src/services/oracle.ts** (MODIFY)
   - Add context to logging messages
   - Improve error clarity

5. **app/lib/parseMarketError.ts** (MODIFY)
   - Enhance error message parsing
   - Add user-friendly recommendations

### Changes Will Include

- ✅ Better error descriptions (same error codes)
- ✅ Added context without changing error structure
- ✅ Improved readability and debuggability
- ✅ User-facing message improvements

### Why It's Safe

- ✅ Error structure unchanged
- ✅ Message improvements only
- ✅ No error handling logic changes
- ✅ Non-breaking - only better messages

### Testing

```bash
# Verify error messages are properly formatted
pnpm lint

# Ensure all tests still pass
pnpm test
```

### PR Description Keywords
- `errors`, `messages`, `user-experience`, `improvement`, `documentation`

---

## Contribution Implementation Order

1. **First**: Contribution #2 (JSDoc) - Lowest risk, good warm-up
2. **Second**: Contribution #3 (Tests) - Builds confidence, adds value
3. **Third**: Contribution #1 (Type Safety) - More complex refactoring
4. **Fourth**: Contribution #4 (Logging) - New module, well-scoped
5. **Fifth**: Contribution #5 (Error Messages) - Touches multiple files, depends on learning from previous PRs

---

## Quality Standards for All Contributions

### Before Submitting Each PR

- [ ] No feature changes - only improvements
- [ ] All existing tests pass: `pnpm test`
- [ ] TypeScript strict mode: `pnpm lint`
- [ ] Code formatted: `pnpm format:check`
- [ ] Types are correct: No `any` types added
- [ ] Comments are clear and complete

### PR Checklist Each Contribution

- [ ] Branch named correctly (e.g., `feat/error-type-safety`)
- [ ] Commit messages are descriptive
- [ ] PR description includes: what, why, testing done
- [ ] No unrelated changes included
- [ ] Ready for code review (no WIP markers)

---

## Testing & Verification Script

```bash
# Run before each PR
echo "Running full test suite..."
pnpm test

echo "Running linter..."
pnpm lint

echo "Checking format..."
pnpm format:check

echo "Type checking..."
pnpm tsc --noEmit

echo "All checks complete! Ready to push."
```

---

## Expected Outcomes

### By End of All Contributions

- ✅ **Type Safety**: Reduced `unknown` usage by ~80%
- ✅ **Documentation**: All public utilities have JSDoc
- ✅ **Test Coverage**: App utils covered by unit tests
- ✅ **Logging**: New structured pattern available
- ✅ **Error Messages**: Better context and clarity
- ✅ **Code Quality**: Maintained 100% - no regressions

### Benefits

- 📈 Better IDE autocomplete and type hints
- 📖 Easier onboarding for new developers
- 🛡️ Type-safe error handling throughout
- 🔍 Better debuggability with structured logging
- 👥 Clearer error messages for users
- 📊 Improved code documentation quality
- ✅ Comprehensive test coverage for utilities

---

## Notes

- Each contribution is completely independent
- No overlapping file modifications across contributions
- Total estimated new code: ~500-800 lines (all comments/docs/tests)
- Total estimated modification: ~50-100 lines (type improvements)
- Zero breaking changes
- All changes backward compatible
- Fits with project's quality standards
