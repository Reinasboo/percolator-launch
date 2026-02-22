# Database Retry Strategy - Implementation Guide

## Quick Start

### 1. Basic Query Retry

```typescript
import { executeDbQuery } from '@percolator/shared/db/manager';

// Add retry resilience to any database query
const markets = await executeDbQuery(
  'getMarkets',
  () => getSupabase().from('markets').select('*')
);
```

### 2. With Preset Options

```typescript
// Use preset retry configurations
const product = await executeDbQuery(
  'getProduct',
  () => getSupabase().from('products').select('*').single(),
  { preset: 'aggressiveRead' }
);
```

### 3. With Circuit Breaker

```typescript
// Protect against cascading failures
const trades = await executeDbQuery(
  'getRecentTrades',
  () => getSupabase().from('trades').select('*').limit(100),
  {
    circuitBreakerName: 'trades-service',
    preset: 'aggressiveRead',
  }
);
```

## Step-by-Step Integration

### Step 1: Update Database Query Functions

**File:** `packages/shared/src/db/queries.ts`

```typescript
// BEFORE
export async function getMarkets(): Promise<MarketRow[]> {
  const { data, error } = await getSupabase().from('markets').select('*');
  if (error) throw error;
  return (data ?? []) as MarketRow[];
}

// AFTER
import { executeDbQuery } from './manager';

export async function getMarkets(): Promise<MarketRow[]> {
  return executeDbQuery(
    'getMarkets',
    () => getSupabase().from('markets').select('*'),
    { preset: 'aggressiveRead' }
  );
}
```

### Step 2: Update API Routes

**File:** `packages/api/src/routes/markets.ts`

```typescript
// BEFORE
app.get('/markets', async (c) => {
  try {
    const markets = await getMarkets();
    return c.json({ markets });
  } catch (error) {
    throw error;  // Will be caught by error handler
  }
});

// AFTER
app.get('/markets', async (c) => {
  try {
    const markets = await executeDbQuery(
      'getMarketsList',
      () => getMarkets(),
      {
        circuitBreakerName: 'markets',
        preset: 'aggressiveRead',
        tags: { endpoint: '/markets' },
      }
    );
    return c.json({ markets });
  } catch (error) {
    throw error;  // Will be caught by error handler
  }
});
```

### Step 3: Update Indexer Operations

**File:** `packages/indexer/src/index.ts`

```typescript
// BEFORE
async function updateMarketStats(stats: any) {
  const { error } = await getSupabase()
    .from('market_stats')
    .upsert(stats, { onConflict: 'slab_address' });
  
  if (error) throw error;
}

// AFTER
import { executeDbQuery } from '@percolator/shared/db/manager';

async function updateMarketStats(stats: any) {
  return executeDbQuery(
    'updateMarketStats',
    () => getSupabase()
      .from('market_stats')
      .upsert(stats, { onConflict: 'slab_address' }),
    {
      circuitBreakerName: 'indexer-writes',
      preset: 'slowWrite',
      tags: { slabAddress: stats.slab_address },
    }
  );
}
```

### Step 4: Add Health Check

**File:** `packages/api/src/routes/health.ts`

```typescript
import { getDbManager } from '@percolator/shared/db/manager';

export function healthRoutes(): Hono {
  const app = new Hono();

  app.get('/health', async (c) => {
    const manager = getDbManager();
    const summary = manager.getMetricsSummary();

    const checks: any = { db: false, rpc: false };
    let status: 'ok' | 'degraded' | 'down' = 'ok';

    // Check RPC connectivity
    try {
      await getConnection().getSlot();
      checks.rpc = true;
    } catch (err) {
      logger.error('RPC check failed', { error: err });
      checks.rpc = false;
    }

    // Check Supabase connectivity
    try {
      await getSupabase().from('markets').select('id', {
        count: 'exact',
        head: true,
      });
      checks.db = true;
    } catch (err) {
      logger.error('DB check failed', { error: err });
      checks.db = false;
    }

    // Determine overall status
    const failedChecks = Object.values(checks).filter((v) => !v).length;
    if (failedChecks === 0) {
      status = 'ok';
    } else if (failedChecks === Object.keys(checks).length) {
      status = 'down';
    } else {
      status = 'degraded';
    }

    return c.json(
      {
        status,
        checks,
        metrics: {
          successRate: summary.successRate.toFixed(4),
          avgLatencyMs: summary.avgDurationMs.toFixed(2),
          circuitBreakers: summary.circuitBreakerStatus,
        },
      },
      status === 'down' ? 503 : 200
    );
  });

  return app;
}
```

### Step 5: Add Monitoring Endpoint

**File:** `packages/api/src/routes/metrics.ts`

```typescript
import { Hono } from 'hono';
import { getDbManager } from '@percolator/shared/db/manager';

export function metricsRoutes(): Hono {
  const app = new Hono();

  app.get('/metrics/database', (c) => {
    const manager = getDbManager();
    const summary = manager.getMetricsSummary();
    const allMetrics = manager.getMetrics();

    // Group by operation
    const byOperation = new Map<string, any>();
    for (const metric of allMetrics) {
      if (!byOperation.has(metric.operationName)) {
        byOperation.set(metric.operationName, []);
      }
      byOperation.get(metric.operationName)!.push(metric);
    }

    return c.json({
      summary,
      topSlowOperations: Array.from(byOperation.entries())
        .map(([name, metrics]) => ({
          operation: name,
          count: metrics.length,
          avgDuration: metrics.reduce((s, m) => s + m.durationMs, 0) / metrics.length,
          errorRate: metrics.filter((m) => !m.success).length / metrics.length,
        }))
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10),
    });
  });

  app.delete('/circuit-breakers/reset', (c) => {
    const manager = getDbManager();
    manager.resetCircuitBreakers();

    return c.json({
      message: 'All circuit breakers reset',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
```

## Common Patterns

### Pattern 1: Read-Heavy Operations

```typescript
export async function getTradeHistory(
  slabAddress: string,
  limit: number = 100
): Promise<TradeRow[]> {
  return executeDbQuery(
    'getTradeHistory',
    () => getSupabase()
      .from('trades')
      .select('*')
      .eq('slab_address', slabAddress)
      .order('created_at', { ascending: false })
      .limit(limit),
    {
      circuitBreakerName: 'trades',
      preset: 'aggressiveRead',  // 5 retries
      tags: { slabAddress, limit },
    }
  );
}
```

### Pattern 2: Write Operations

```typescript
export async function insertTrade(trade: TradeRow): Promise<void> {
  return executeDbQuery(
    'insertTrade',
    () => getSupabase()
      .from('trades')
      .insert([trade]),
    {
      circuitBreakerName: 'trades-writes',
      preset: 'slowWrite',  // 4 retries, slower backoff
      tags: {
        slabAddress: trade.slab_address,
        trader: trade.trader,
        side: trade.side,
      },
    }
  );
}
```

### Pattern 3: Critical Operations

```typescript
export async function updateMarketStatus(
  slabAddress: string,
  status: 'active' | 'paused' | 'resolved'
): Promise<void> {
  return executeDbQuery(
    'updateMarketStatus',
    () => getSupabase()
      .from('markets')
      .update({ status })
      .eq('slab_address', slabAddress),
    {
      circuitBreakerName: 'market-updates',
      preset: 'critical',  // 7 retries
      tags: { slabAddress, status },
    }
  );
}
```

### Pattern 4: Time-Sensitive Operations

```typescript
export async function updateWebSocketMarketData(
  slabAddress: string,
  data: any
): Promise<void> {
  return executeDbQuery(
    'updateWebSocketData',
    () => getSupabase()
      .from('websocket_cache')
      .upsert({ slab_address: slabAddress, data }),
    {
      circuitBreakerName: 'websocket',
      preset: 'quick',  // 2 retries, fast
      tags: { slabAddress },
    }
  );
}
```

### Pattern 5: Batch Operations

```typescript
export async function insertTrades(trades: TradeRow[]): Promise<void> {
  return executeDbQuery(
    'insertMultipleTrades',
    () => getSupabase()
      .from('trades')
      .insert(trades),
    {
      circuitBreakerName: 'batch-writes',
      preset: 'slowWrite',
      tags: { count: trades.length },
    }
  );
}
```

## Error Handling Integration

### With Standardized Error Handler

```typescript
import { BadRequestError, ServiceUnavailableError } from '@percolator/api';
import { executeDbQuery } from '@percolator/shared/db/manager';

async function createMarket(params: any) {
  try {
    const market = await executeDbQuery(
      'createMarket',
      () => getSupabase()
        .from('markets')
        .insert([params])
        .select()
        .single(),
      { preset: 'normal' }
    );

    return market;
  } catch (error) {
    // Error handler middleware catches this and formats response
    // Circuit breaker errors are retried internally
    // Permanent errors (duplicate key) bubble up
    throw error;
  }
}
```

### With Fallback

```typescript
import { executeDbQuery } from '@percolator/shared/db/manager';

async function getMarketWithFallback(slabAddress: string) {
  try {
    return await executeDbQuery(
      'getMarket',
      () => getSupabase()
        .from('markets')
        .select('*')
        .eq('slab_address', slabAddress)
        .single(),
      { preset: 'aggressiveRead' }
    );
  } catch (error) {
    // Log the error
    logger.error('Failed to fetch market', {
      slabAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return cached data if available
    const cached = cache.get(slabAddress);
    if (cached) {
      return cached;
    }

    // Propagate error to be handled by middleware
    throw error;
  }
}
```

## Testing Integration

### Unit Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDbQuery } from '@percolator/shared/db/manager';

describe('Trade insertion with retry', () => {
  it('should insert trade after transient failure', async () => {
    const insertFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ id: 'trade-123' });

    const result = await executeDbQuery(
      'insertTrade',
      insertFn,
      { preset: 'slowWrite' }
    );

    expect(result.id).toBe('trade-123');
    expect(insertFn).toHaveBeenCalledTimes(2);
  });

  it('should fail immediately on duplicate key', async () => {
    const error: any = {
      code: '23505',
      message: 'duplicate key',
    };
    const insertFn = vi.fn().mockRejectedValue(error);

    await expect(
      executeDbQuery('insertTrade', insertFn, { preset: 'slowWrite' })
    ).rejects.toBe(error);

    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  it('should open circuit after failures', async () => {
    // Simulate repeated failures
    const queryFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    for (let i = 0; i < 5; i++) {
      try {
        await executeDbQuery(
          'operation',
          queryFn,
          { circuitBreakerName: 'test-service' }
        );
      } catch {}
    }

    // Circuit should be open now
    const manager = getDbManager();
    const metrics = manager.getMetricsSummary();
    expect(metrics.circuitBreakerStatus['test-service'].state).toBe('OPEN');
  });
});
```

## Migration Checklist

- [ ] Update `packages/shared/src/db/queries.ts` to use `executeDbQuery`
- [ ] Update API routes in `packages/api/src/routes/*.ts`
- [ ] Update indexer queries in `packages/indexer/src/*.ts`
- [ ] Add health check endpoint metrics
- [ ] Add database metrics endpoint
- [ ] Update integration tests with retry scenarios
- [ ] Add unit tests for circuit breaker behavior
- [ ] Document any custom retry configurations
- [ ] Update README with new resilience features
- [ ] Monitor metrics in production

## Performance Impact

**Typical overhead per query:**
- Zero retry (no failures): < 1ms
- Single retry (transient error): + base delay (default 100ms)
- Circuit breaker check: < 1ms

**Total time for resilience:**
- Success case: negligible
- Single failure → retry: base delay (100ms) + jitter (±10ms)
- Multiple failures: exponential backoff capped at 30s

## Monitoring Dashboard

Log these metrics to your monitoring system:

```typescript
const manager = getDbManager();
const summary = manager.getMetricsSummary();

sendMetrics({
  'percolator.db.operations.total': summary.totalOperations,
  'percolator.db.operations.success': summary.successCount,
  'percolator.db.operations.failed': summary.failureCount,
  'percolator.db.success_rate': summary.successRate,
  'percolator.db.avg_latency_ms': summary.avgDurationMs,
  'percolator.circuit_breaker.open': Object.values(
    summary.circuitBreakerStatus
  ).filter((cb: any) => cb.state === 'OPEN').length,
});
```

## Support & Debugging

### Enable Debug Logging

```typescript
import { createLogger } from '@percolator/shared';

const logger = createLogger('db:debug');
logger.setLevel('debug');
```

### Check Circuit Breaker Status

```typescript
import { getDbManager } from '@percolator/shared/db/manager';

const manager = getDbManager();
const summary = manager.getMetricsSummary();
console.log(summary.circuitBreakerStatus);
```

### View Recent Operations

```typescript
const manager = getDbManager();
const metrics = manager.getMetrics();
const lastFailed = metrics
  .reverse()
  .find((m) => !m.success);
console.log({
  operation: lastFailed?.operationName,
  error: lastFailed?.errorCode,
  duration: lastFailed?.durationMs,
});
```
