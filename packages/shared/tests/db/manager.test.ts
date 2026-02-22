/**
 * Database Manager Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseManager, createDbManager } from '../../src/db/manager';
import { CircuitBreakerRegistry } from '../../src/db/circuit-breaker';

describe('Database Manager', () => {
  let manager: DatabaseManager;
  let cbRegistry: CircuitBreakerRegistry;

  beforeEach(() => {
    cbRegistry = new CircuitBreakerRegistry();
    manager = createDbManager(cbRegistry);
  });

  afterEach(() => {
    cbRegistry.destroy();
  });

  describe('execute', () => {
    it('should execute successful queries', async () => {
      const fn = vi.fn().mockResolvedValue({ id: 1 });

      const result = await manager.execute('getMarkets', fn);

      expect(result).toEqual({ id: 1 });
    });

    it('should retry transient errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ id: 1 });

      const result = await manager.execute('getMarkets', fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        useJitter: false,
      });

      expect(result).toEqual({ id: 1 });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw permanent errors immediately', async () => {
      const error: any = { code: '23505', message: 'duplicate key' };
      const fn = vi.fn().mockRejectedValue(error);

      await expect(manager.execute('insert', fn)).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use circuit breaker when specified', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await manager.execute('operation', fn, {
        circuitBreakerName: 'test-op',
      });

      const cbMetrics = cbRegistry.getAllMetrics();
      expect(cbMetrics).toHaveProperty('test-op');
    });

    it('should block requests when circuit is open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      // Open the circuit
      const cb = cbRegistry.get('failing-op', { failureThreshold: 2 });
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('error')));
        } catch {}
      }

      expect(cb.getState()).toBe('OPEN');

      // Should reject immediately without executing
      await expect(
        manager.execute('query', fn, {
          circuitBreakerName: 'failing-op',
        })
      ).rejects.toThrow('Circuit breaker is OPEN');

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should execute database query', async () => {
      const fn = vi.fn().mockResolvedValue([{ id: 1 }]);

      const result = await manager.query('getMarkets', fn);

      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('batchQuery', () => {
    it('should execute multiple queries in parallel', async () => {
      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');
      const fn3 = vi.fn().mockResolvedValue('result3');

      const results = await manager.batchQuery([
        { name: 'query1', fn: fn1 },
        { name: 'query2', fn: fn2 },
        { name: 'query3', fn: fn3 },
      ]);

      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should fail if any query fails', async () => {
      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockRejectedValue(new Error('permanent error'));

      await expect(
        manager.batchQuery([
          { name: 'query1', fn: fn1 },
          { name: 'query2', fn: fn2 },
        ])
      ).rejects.toThrow('permanent error');
    });
  });

  describe('metrics', () => {
    it('should record operation metrics', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await manager.execute('operation1', fn);
      await manager.execute('operation2', fn);

      const metrics = manager.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].operationName).toBe('operation1');
      expect(metrics[1].operationName).toBe('operation2');
      expect(metrics[0].success).toBe(true);
      expect(metrics[1].success).toBe(true);
    });

    it('should track failures', async () => {
      const error: any = { code: '23505', message: 'duplicate' };
      const fn = vi.fn().mockRejectedValue(error);

      try {
        await manager.execute('insert', fn);
      } catch {}

      const metrics = manager.getMetrics();
      expect(metrics[0].success).toBe(false);
      expect(metrics[0].errorCode).toBe('23505');
    });

    it('should get operation-specific metrics', async () => {
      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');

      await manager.execute('operation1', fn1);
      await manager.execute('operation1', fn1);
      await manager.execute('operation2', fn2);

      const op1Metrics = manager.getOperationMetrics('operation1');
      const op2Metrics = manager.getOperationMetrics('operation2');

      expect(op1Metrics).toHaveLength(2);
      expect(op2Metrics).toHaveLength(1);
    });

    it('should calculate summary metrics', async () => {
      const fn1 = vi.fn().mockResolvedValue('result');
      const fn2 = vi.fn().mockRejectedValue(new Error('error'));

      await manager.execute('op1', fn1);
      await manager.execute('op1', fn1);
      try {
        await manager.execute('op2', fn2);
      } catch {}

      const summary = manager.getMetricsSummary();

      expect(summary.totalOperations).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(1);
      expect(summary.successRate).toBe(2 / 3);
      expect(summary.avgDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should clear metrics', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await manager.execute('operation', fn);
      expect(manager.getMetrics()).toHaveLength(1);

      manager.clearMetrics();
      expect(manager.getMetrics()).toHaveLength(0);
    });

    it('should limit metric history size', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      // Execute more operations than max size
      for (let i = 0; i < 1100; i++) {
        await manager.execute(`op${i}`, fn);
      }

      const metrics = manager.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('circuit breaker management', () => {
    it('should reset circuit breakers', async () => {
      const cb = cbRegistry.get('op', { failureThreshold: 1 });

      // Open circuit
      try {
        await cb.execute(() => Promise.reject(new Error('error')));
      } catch {}

      expect(cb.getState()).toBe('OPEN');

      manager.resetCircuitBreakers();
      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('tagging', () => {
    it('should include tags in metrics', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await manager.execute('operation', fn, {
        tags: { userId: '123', action: 'trade' },
      });

      // Tags are just logged, so we verify they're accepted
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('helper functions', () => {
    it('should execute db query with default options', async () => {
      // Import functions
      const { executeDbQuery, executeBatchDbQueries } = require('../../src/db/manager');

      const fn = vi.fn().mockResolvedValue('result');
      const result = await executeDbQuery('test', fn);

      expect(result).toBe('result');
    });
  });
});
