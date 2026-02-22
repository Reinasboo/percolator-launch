# Database Query Error Handling & Retries

## Overview

A comprehensive database resilience system for the Percolator Launch API that implements:

- **Automatic Retries** with exponential backoff and jitter
- **Circuit Breaker Pattern** to prevent cascading failures
- **Error Classification** to distinguish retryable vs permanent errors
- **Metrics & Monitoring** for observability
- **Integration** with standardized error handling

## Architecture

### Components

#### 1. Error Classifier (`error-classifier.ts`)

Intelligently classifies database errors as **retryable** or **permanent**.

**Retryable Errors (Transient):**
- Connection timeout/refused: `ECONNREFUSED`, `ETIMEDOUT`
- Connection reset: `ECONNRESET`, `EPIPE`
- Pool exhaustion: "connection pool"
- PostgreSQL transient codes: `57P03`, `08P01`, `08006`

**Permanent Errors:**
- Constraint violations: `23505` (unique), `23502` (not null), `23514` (check)
- Schema errors: `42703` (undefined column), `42601` (syntax error)
- Authentication errors: `28P01` (invalid password)
- Permission errors: `42501` (insufficient privilege)

```typescript
import { classifyError, shouldRetry } from '@percolator/shared/db/error-classifier';

const error = new Error('ECONNREFUSED');
const classified = classifyError(error);

console.log(classified.isRetryable);        // true
console.log(classified.severity);            // 'transient'
console.log(classified.suggestedWaitMs);     // 500
```

#### 2. Retry Strategy (`retry-strategy.ts`)

Implements exponential backoff with optional jitter.

**Formula:** `baseDelay * (multiplier ^ attempt) [± jitter]`

**Key Features:**
- Configurable max retries, delays, and backoff multiplier
- Random jitter to prevent thundering herd
- Timeout per attempt
- Custom retry predicates
- Retry callbacks for logging/monitoring

```typescript
import { executeWithRetry, PRESET_RETRY_OPTIONS } from '@percolator/shared/db/retry-strategy';

// Aggressive retries for critical reads
const result = await executeWithRetry(
  () => getSupabase().from('markets').select('*'),
  PRESET_RETRY_OPTIONS.aggressiveRead
);

// result: { success: true, data: [...], attempts: 2, totalDelayMs: 150 }
```

**Preset Options:**

| Preset | Retries | Base Delay | Max Delay | Use Case |
|--------|---------|-----------|-----------|----------|
| `aggressiveRead` | 5 | 50ms | 10s | Critical reads (market data) |
| `normal` | 3 | 100ms | 30s | Standard operations |
| `quick` | 2 | 50ms | 5s | Time-sensitive (WebSocket) |
| `slowWrite` | 4 | 200ms | 60s | Trade insertion, writes |
| `critical` | 7 | 100ms | 120s | Critical operations |
| `noRetry` | 0 | - | - | No retries |

#### 3. Circuit Breaker (`circuit-breaker.ts`)

Prevents cascading failures by temporarily halting requests to failing services.

**States:**
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service failing, requests rejected immediately
- **HALF_OPEN**: Testing if service recovered, limited requests allowed

**Transitions:**
```
CLOSED --[failures >= threshold]--> OPEN
OPEN --[timeout elapsed]--> HALF_OPEN
HALF_OPEN --[successes >= threshold]--> CLOSED
HALF_OPEN --[failure]--> OPEN
```

```typescript
import { CircuitBreaker } from '@percolator/shared/db/circuit-breaker';

const breaker = new CircuitBreaker({
  failureThreshold: 5,    // Open after 5 failures
  successThreshold: 2,    // Close after 2 successes in HALF_OPEN
  resetTimeoutMs: 60000,  // Try recovery after 60s
});

try {
  const result = await breaker.execute(async () => {
    return getSupabase().from('trades').select('*');
  });
} catch (err) {
  // Circuit is open and blocking requests
  console.error('Service unavailable');
}

// Get state and metrics
console.log(breaker.getState());      // 'OPEN' | 'CLOSED' | 'HALF_OPEN'
console.log(breaker.getMetrics());    // Full metrics object
```

#### 4. Database Manager (`manager.ts`)

Centralized manager integrating all components.

```typescript
import { executeDbQuery, getDbManager } from '@percolator/shared/db/manager';
import { PRESET_RETRY_OPTIONS } from '@percolator/shared/db/retry-strategy';

// Simple usage
const markets = await executeDbQuery(
  'getMarkets',
  () => getSupabase().from('markets').select('*'),
  { preset: 'aggressiveRead' }
);

// Advanced usage with circuit breaker
const trades = await executeDbQuery(
  'getRecentTrades',
  () => getSupabase().from('trades').select('*').limit(50),
  {
    circuitBreakerName: 'trades-service',
    preset: 'normal',
    tags: { marketId: '123', userId: '456' },
  }
);

// Get metrics
const manager = getDbManager();
const summary = manager.getMetricsSummary();
console.log(summary);
// {
//   totalOperations: 1500,
//   successCount: 1485,
//   failureCount: 15,
//   successRate: 0.99,
//   avgDurationMs: 45.3,
//   circuitBreakerStatus: { ... }
// }
```

## Usage Examples

### Basic Query with Retry

```typescript
import { executeDbQuery } from '@percolator/shared/db/manager';

// Automatically retries with exponential backoff
const market = await executeDbQuery(
  'getMarketBySlabAddress',
  () => getSupabase()
    .from('markets')
    .select('*')
    .eq('slab_address', slabAddress)
    .single(),
  { maxRetries: 3 }
);
```

### Custom Retry Predicate

Only retry certain errors:

```typescript
const result = await executeDbQuery(
  'customQuery',
  () => getSupabase().from('custom_table').select('*'),
  {
    maxRetries: 5,
    shouldRetryFn: (error, attempt) => {
      // Only retry on timeout, not network errors
      return error.message.includes('timeout');
    },
  }
);
```

### Batch Queries with Retry

```typescript
import { executeBatchDbQueries } from '@percolator/shared/db/manager';

const [markets, trades, prices] = await executeBatchDbQueries([
  {
    name: 'getMarkets',
    fn: () => getSupabase().from('markets').select('*'),
  },
  {
    name: 'getRecentTrades',
    fn: () => getSupabase().from('trades').select('*').limit(100),
  },
  {
    name: 'getOraclePrices',
    fn: () => getSupabase().from('oracle_prices').select('*'),
  },
], { preset: 'aggressiveRead' });
```

### Integration with API Routes

```typescript
import { Hono } from 'hono';
import { executeDbQuery } from '@percolator/shared/db/manager';
import { BadRequestError } from '@percolator/api';

export function marketRoutes(): Hono {
  const app = new Hono();

  app.get('/markets/:slab', async (c) => {
    const slab = c.req.param('slab');

    try {
      const market = await executeDbQuery(
        'getMarketBySlabAddress',
        () => getSupabase()
          .from('markets')
          .select('*')
          .eq('slab_address', slab)
          .single(),
        {
          circuitBreakerName: 'markets',
          preset: 'aggressiveRead',
          tags: { slabAddress: slab },
        }
      );

      if (!market) {
        throw new BadRequestError('Market not found', { slab });
      }

      return c.json({ market });
    } catch (err) {
      // Error handling already covered by error handler middleware
      throw err;
    }
  });

  return app;
}
```

### Monitoring Query Performance

```typescript
import { getDbManager } from '@percolator/shared/db/manager';

// In a periodic health check
setInterval(() => {
  const manager = getDbManager();
  const summary = manager.getMetricsSummary();

  console.log('Database Performance:', {
    successRate: summary.successRate,
    avgLatency: summary.avgDurationMs,
    failures: summary.failureCount,
    circuitStates: summary.circuitBreakerStatus,
  });

  // Alert if success rate drops
  if (summary.successRate < 0.95) {
    logger.warn('Database success rate degraded', { summary });
  }
}, 60000); // Every minute
```

## Performance Characteristics

### Exponential Backoff Delays

With default options (100ms base, 2x multiplier):

| Attempt | Delay (no jitter) | Delay (±10% jitter) |
|---------|------------------|-------------------|
| 1 | 100ms | 90-110ms |
| 2 | 200ms | 180-220ms |
| 3 | 400ms | 360-440ms |
| 4 | 800ms | 720-880ms |
| 5 | 1600ms | 1440-1760ms |

**Total wait time for 3 retries: ~700ms**

### Circuit Breaker Thresholds

Recommended settings by service type:

**Read-Heavy Services:**
- Failure threshold: 5-10
- Success threshold: 2
- Reset timeout: 30-60s

**Write Services:**
- Failure threshold: 3-5
- Success threshold: 3
- Reset timeout: 60-120s

**Critical Services:**
- Failure threshold: 10-20
- Success threshold: 5
- Reset timeout: 120s

## Error Handling Integration

Works seamlessly with standardized API error handling:

```typescript
import { BadRequestError, ServiceUnavailableError } from '@percolator/api';
import { executeDbQuery } from '@percolator/shared/db/manager';

try {
  const data = await executeDbQuery('operation', queryFn);
} catch (error) {
  if (error.message.includes('Circuit breaker')) {
    // Service temporarily unavailable
    throw new ServiceUnavailableError('Database service unavailable');
  }

  if (error.code === '23505') {
    // Duplicate key - permanent error
    throw new BadRequestError('Resource already exists');
  }

  // Let default error handler catch it
  throw error;
}
```

## Best Practices

### 1. Choose Appropriate Retry Presets

```typescript
// ❌ Wrong: Critical read uses no retries
const market = await executeDbQuery(
  'getMarket',
  queryFn,
  { preset: 'noRetry' }
);

// ✅ Correct: Critical reads use aggressive retries
const market = await executeDbQuery(
  'getMarket',
  queryFn,
  { preset: 'aggressiveRead' }
);
```

### 2. Use Circuit Breakers for External Dependencies

```typescript
// ✅ Correct: Protect external service calls
await executeDbQuery('externalApi', externalCall, {
  circuitBreakerName: 'external-service',
});

// ❌ Wrong: Internal queries don't need circuit breakers
await executeDbQuery('internalQuery', internalQuery, {
  circuitBreakerName: 'redundant',
});
```

### 3. Tag Operations for Monitoring

```typescript
// ✅ Correct: Include context for debugging
await executeDbQuery('insertTrade', tradeQuery, {
  tags: {
    marketId: market.id,
    userId: user.id,
    tradeSize: size,
    side: 'long',
  },
});

// ❌ Wrong: No context
await executeDbQuery('insertTrade', tradeQuery);
```

### 4. Handle Circuit Breaker Errors

```typescript
try {
  const result = await executeDbQuery(
    'operation',
    queryFn,
    { circuitBreakerName: 'service' }
  );
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    // Return cached data or degraded response
    return getCachedResult() || getDefaultResponse();
  }
  throw error;
}
```

### 5. Monitor Metrics Regularly

```typescript
// In health check endpoint
app.get('/health/database', (c) => {
  const manager = getDbManager();
  const summary = manager.getMetricsSummary();

  const health = summary.successRate >= 0.99 ? 'ok' : 'degraded';

  return c.json({
    database: health,
    metrics: summary,
  }, summary.successRate >= 0.99 ? 200 : 503);
});
```

## Configuration

### Environment Variables

```bash
# Database connection settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Optional: Retry configuration
DB_MAX_RETRIES=3
DB_BASE_DELAY_MS=100
DB_MAX_DELAY_MS=30000

# Optional: Circuit breaker configuration
DB_CB_FAILURE_THRESHOLD=5
DB_CB_SUCCESS_THRESHOLD=2
DB_CB_RESET_TIMEOUT_MS=60000
```

### Runtime Configuration

```typescript
import { getDbManager } from '@percolator/shared/db/manager';

// Customize retry options globally
const manager = getDbManager();

// Reset circuit breakers if needed
manager.resetCircuitBreakers();

// Get current metrics
const metrics = manager.getMetricsSummary();
```

## Troubleshooting

### Circuit Breaker Stays Open

**Symptoms:** "Circuit breaker is OPEN" errors even after service recovers

**Solutions:**
1. Check if service is actually healthy:
   ```typescript
   const metrics = getDbManager().getMetricsSummary();
   console.log(metrics.circuitBreakerStatus);
   ```

2. Manually reset if needed:
   ```typescript
   getDbManager().resetCircuitBreakers();
   ```

3. Increase `resetTimeoutMs` if service recovery is slow

### Retries Not Working

**Symptoms:** Queries fail immediately without retrying

**Solutions:**
1. Verify error is classified as retryable:
   ```typescript
   import { shouldRetry } from '@percolator/shared/db/error-classifier';
   console.log(shouldRetry(error)); // Should be true
   ```

2. Check retry configuration:
   ```typescript
   await executeDbQuery('op', queryFn, {
     maxRetries: 5,  // Increase if too low
     baseDelayMs: 100,
   });
   ```

### High Latency

**Symptoms:** Database queries are slow

**Solutions:**
1. Reduce max retries for non-critical operations:
   ```typescript
   preset: 'quick';  // 2 retries instead of 3
   ```

2. Lower base delay for time-sensitive operations:
   ```typescript
   baseDelayMs: 50;  // Faster initial retry
   ```

3. Analyze metrics to identify problematic operations:
   ```typescript
   const metrics = getDbManager().getMetrics();
   const slow = metrics.filter(m => m.durationMs > 1000);
   ```

## Testing

### Unit Tests

```typescript
import { executeWithRetry } from '@percolator/shared/db/retry-strategy';
import { CircuitBreaker } from '@percolator/shared/db/circuit-breaker';

describe('Database Resilience', () => {
  it('should retry transient errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) throw new Error('ECONNREFUSED');
      return 'success';
    };

    const result = await executeWithRetry(fn);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(2);
  });

  it('should open circuit after threshold', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fn = () => Promise.reject(new Error('fail'));

    try {
      await breaker.execute(fn);
    } catch {}

    expect(breaker.getState()).toBe('OPEN');
  });
});
```

### Integration Tests

```typescript
// Real database with mocked errors
import { getSupabase } from '@percolator/shared';
import { executeDbQuery } from '@percolator/shared/db/manager';

describe('Database Integration', () => {
  it('should handle real database failures', async () => {
    // This will hit the real database
    const markets = await executeDbQuery(
      'getMarkets',
      () => getSupabase().from('markets').select('*'),
      { preset: 'aggressiveRead' }
    );

    expect(markets).toBeInstanceOf(Array);
  });
});
```

## Migration Guide

### Converting Existing Queries

**Before:**
```typescript
const market = await getSupabase()
  .from('markets')
  .select('*')
  .eq('slab_address', slab)
  .single();
```

**After:**
```typescript
const market = await executeDbQuery(
  'getMarketBySlabAddress',
  () => getSupabase()
    .from('markets')
    .select('*')
    .eq('slab_address', slab)
    .single(),
  { preset: 'aggressiveRead' }
);
```

## Metrics & Observability

### Available Metrics

```typescript
interface DbOperationMetrics {
  operationName: string;
  success: boolean;
  attempts: number;
  totalDelayMs: number;
  errorCode?: string;
  circuitBreakerState?: string;
  durationMs: number;
}
```

### Export to Monitoring System

```typescript
import { getDbManager } from '@percolator/shared/db/manager';

// Export metrics to Prometheus, DataDog, etc.
app.get('/metrics/database', (c) => {
  const manager = getDbManager();
  const summary = manager.getMetricsSummary();

  return c.json({
    'db.operations.total': summary.totalOperations,
    'db.operations.success': summary.successCount,
    'db.operations.failed': summary.failureCount,
    'db.success_rate': summary.successRate,
    'db.avg_latency_ms': summary.avgDurationMs,
    'circuit_breakers': summary.circuitBreakerStatus,
  });
});
```

## Performance Tuning

### For 99.9% Availability Target

```typescript
// Aggressive but not excessive retries
const config = {
  maxRetries: 5,
  baseDelayMs: 100,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  useJitter: true,
  timeoutMs: 30000,
};

// Sensitive circuit breaker
const cbConfig = {
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeoutMs: 30000,
};
```

### For Low-Latency Requirements

```typescript
// Fast but limited retries
const config = {
  maxRetries: 2,
  baseDelayMs: 50,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  useJitter: true,
  timeoutMs: 5000,
};
```

## References

- AWS SDK Retry Strategy: https://docs.aws.amazon.com/general/latest/gr/api-retries.html
- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Exponential Backoff: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

## Support

For issues or questions:
1. Check troubleshooting section above
2. View test cases for usage examples
3. Review metrics for performance issues
4. Check circuit breaker state in health endpoints
