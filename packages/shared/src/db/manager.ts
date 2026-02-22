/**
 * Database Manager
 * 
 * Integrates retry strategy, circuit breaker, and error handling
 * for safe and reliable database operations.
 */

import { createLogger } from '../logger';
import { executeWithRetry, RetryOptions, PRESET_RETRY_OPTIONS, wrapWithRetry } from './retry-strategy';
import { CircuitBreakerRegistry, circuitBreakerRegistry } from './circuit-breaker';
import { classifyError } from './error-classifier';

const logger = createLogger('db:manager');

export interface DbOperationOptions extends RetryOptions {
  /** Circuit breaker name (enables circuit breaker if set) */
  circuitBreakerName?: string;

  /** Use circuit breaker (default: true if circuitBreakerName is set) */
  useCircuitBreaker?: boolean;

  /** Tags for logging and metrics */
  tags?: Record<string, any>;
}

export interface DbOperationMetrics {
  operationName: string;
  success: boolean;
  attempts: number;
  totalDelayMs: number;
  errorCode?: string;
  circuitBreakerState?: string;
  durationMs: number;
}

/**
 * Database operation manager
 */
export class DatabaseManager {
  private circuitBreakers: CircuitBreakerRegistry;
  private operationMetrics: DbOperationMetrics[] = [];
  private maxMetricsSize = 1000; // Keep last 1000 operations

  constructor(circuitBreakers: CircuitBreakerRegistry = circuitBreakerRegistry) {
    this.circuitBreakers = circuitBreakers;
  }

  /**
   * Execute a database operation with automatic retry and circuit breaker
   */
  async execute<T>(
    operationName: string,
    fn: () => Promise<T>,
    options: DbOperationOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const opts = { ...PRESET_RETRY_OPTIONS.normal, ...options };

    try {
      // Get circuit breaker if requested
      const cbName = opts.circuitBreakerName;
      const useCircuitBreaker = opts.useCircuitBreaker !== false && cbName;

      let result: T;

      if (useCircuitBreaker) {
        const cb = this.circuitBreakers.get(cbName);
        result = await cb.execute(() => executeWithRetry(fn, opts).then((r) => {
          if (!r.success) throw r.error;
          return r.data!;
        }));
      } else {
        const result = await executeWithRetry(fn, opts);
        if (!result.success) throw result.error;
        return result.data!;
      }

      // Record successful operation
      const durationMs = Date.now() - startTime;
      const metrics: DbOperationMetrics = {
        operationName,
        success: true,
        attempts: 1,
        totalDelayMs: 0,
        durationMs,
        circuitBreakerState: useCircuitBreaker
          ? this.circuitBreakers.get(cbName)?.getState()
          : undefined,
      };
      this.recordMetrics(metrics);

      logger.debug('Database operation succeeded', {
        operationName,
        durationMs,
        tags: opts.tags,
      });

      return result;
    } catch (error) {
      // Record failed operation
      const durationMs = Date.now() - startTime;
      const classified = classifyError(error);
      const metrics: DbOperationMetrics = {
        operationName,
        success: false,
        attempts: 0, // TODO: track from result
        totalDelayMs: 0,
        errorCode: classified.code,
        durationMs,
        circuitBreakerState: options.circuitBreakerName
          ? this.circuitBreakers.get(options.circuitBreakerName)?.getState()
          : undefined,
      };
      this.recordMetrics(metrics);

      logger.error('Database operation failed', {
        operationName,
        errorCode: classified.code,
        severity: classified.severity,
        durationMs,
        tags: opts.tags,
      });

      throw error;
    }
  }

  /**
   * Query with retry and circuit breaker
   */
  async query<T>(
    operationName: string,
    queryFn: () => Promise<T>,
    options: DbOperationOptions = {}
  ): Promise<T> {
    return this.execute(operationName, queryFn, options);
  }

  /**
   * Batch query with individual operation tracking
   */
  async batchQuery<T>(
    operations: Array<{ name: string; fn: () => Promise<T> }>,
    options: DbOperationOptions = {}
  ): Promise<T[]> {
    return Promise.all(
      operations.map((op) => this.execute(op.name, op.fn, options))
    );
  }

  /**
   * Get operation metrics
   */
  getMetrics(): DbOperationMetrics[] {
    return [...this.operationMetrics];
  }

  /**
   * Get metrics for specific operation
   */
  getOperationMetrics(operationName: string): DbOperationMetrics[] {
    return this.operationMetrics.filter((m) => m.operationName === operationName);
  }

  /**
   * Get summary metrics
   */
  getMetricsSummary(): {
    totalOperations: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgDurationMs: number;
    circuitBreakerStatus: Record<string, any>;
  } {
    const total = this.operationMetrics.length;
    const successful = this.operationMetrics.filter((m) => m.success).length;
    const failed = total - successful;
    const avgDuration =
      total > 0
        ? this.operationMetrics.reduce((sum, m) => sum + m.durationMs, 0) / total
        : 0;

    return {
      totalOperations: total,
      successCount: successful,
      failureCount: failed,
      successRate: total > 0 ? successful / total : 1,
      avgDurationMs: avgDuration,
      circuitBreakerStatus: this.circuitBreakers.getAllMetrics(),
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.operationMetrics = [];
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.resetAll();
  }

  /**
   * Record operation metrics
   */
  private recordMetrics(metrics: DbOperationMetrics): void {
    this.operationMetrics.push(metrics);

    // Keep only last N metrics
    if (this.operationMetrics.length > this.maxMetricsSize) {
      this.operationMetrics = this.operationMetrics.slice(-this.maxMetricsSize);
    }
  }
}

// Global database manager instance
let _dbManager: DatabaseManager | null = null;

/**
 * Get global database manager
 */
export function getDbManager(): DatabaseManager {
  if (!_dbManager) {
    _dbManager = new DatabaseManager();
  }
  return _dbManager;
}

/**
 * Create a new database manager
 */
export function createDbManager(circuitBreakers?: CircuitBreakerRegistry): DatabaseManager {
  return new DatabaseManager(circuitBreakers);
}

/**
 * Helper to execute a database query with standard retry options
 */
export async function executeDbQuery<T>(
  operationName: string,
  queryFn: () => Promise<T>,
  options: DbOperationOptions = {}
): Promise<T> {
  return getDbManager().execute(operationName, queryFn, options);
}

/**
 * Batch execute multiple database queries
 */
export async function executeBatchDbQueries<T>(
  operations: Array<{ name: string; fn: () => Promise<T> }>,
  options: DbOperationOptions = {}
): Promise<T[]> {
  return getDbManager().batchQuery(operations, options);
}
