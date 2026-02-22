/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerRegistry } from '../../src/db/circuit-breaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeoutMs: 100,
    });
  });

  afterEach(() => {
    breaker.destroy();
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should have zero metrics', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('CLOSED state behavior', () => {
    it('should allow requests to pass through', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should accumulate failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));

      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(fn);
        } catch {}
      }

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(2);
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition to OPEN after threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));
      const onStateChange = vi.fn();
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        onStateChange,
      });

      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(fn);
        } catch {}
      }

      expect(breaker.getState()).toBe('OPEN');
      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN');
    });

    it('should reset failure count on success', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce('success');

      try {
        await breaker.execute(fn);
      } catch {}

      await breaker.execute(fn);

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
    });
  });

  describe('OPEN state behavior', () => {
    beforeEach(async () => {
      const fn = vi.fn().mockRejectedValue(new Error('error'));
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 200,
      });

      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(fn);
        } catch {}
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should reject requests immediately', async () => {
      const fn = vi.fn();

      await expect(breaker.execute(fn)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );

      expect(fn).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const fn = vi.fn();

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Should now be in HALF_OPEN state
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
  });

  describe('HALF_OPEN state behavior', () => {
    beforeEach(async () => {
      const fn = vi.fn().mockRejectedValue(new Error('error'));
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
        onStateChange: vi.fn(),
      });

      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(fn);
        } catch {}
      }

      // Wait for transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should allow test requests through', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should count successes in HALF_OPEN', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await breaker.execute(fn);

      const metrics = breaker.getMetrics();
      expect(metrics.successCount).toBe(1);
    });

    it('should transition to CLOSED after threshold successes', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      for (let i = 0; i < 2; i++) {
        await breaker.execute(fn);
      }

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should go back to OPEN on failure', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('error'));

      try {
        await breaker.execute(fn);
      } catch {}

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('manual control', () => {
    it('should reset circuit', () => {
      const fn = vi.fn().mockRejectedValue(new Error('error'));
      breaker = new CircuitBreaker({ failureThreshold: 1 });

      try {
        breaker.execute(fn);
      } catch {}

      expect(breaker.getState()).toBe('OPEN');

      breaker.reset();
      expect(breaker.getState()).toBe('CLOSED');

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
    });

    it('should force open', () => {
      breaker.open();
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('metrics', () => {
    it('should track total requests', async () => {
      const fn = vi
        .fn()
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('error'));

      await breaker.execute(fn);
      await breaker.execute(fn);
      try {
        await breaker.execute(fn);
      } catch {}

      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.totalFailures).toBe(1);
    });

    it('should track last failure time', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('error'));

      try {
        await breaker.execute(fn);
      } catch {}

      const metrics = breaker.getMetrics();
      expect(metrics.lastFailureTime).toBeDefined();
      expect(metrics.lastFailureTime).toBeGreaterThan(0);
    });
  });
});

describe('Circuit Breaker Registry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should create breakers on demand', () => {
    const breaker1 = registry.get('operation-1');
    const breaker2 = registry.get('operation-1');

    expect(breaker1).toBe(breaker2); // Same instance
  });

  it('should support custom options', () => {
    const breaker = registry.get('operation', { failureThreshold: 10 });
    const metrics = breaker.getMetrics();

    expect(metrics.state).toBe('CLOSED');
  });

  it('should return all breakers', () => {
    registry.get('op1');
    registry.get('op2');
    registry.get('op3');

    const all = registry.getAll();
    expect(all.size).toBe(3);
  });

  it('should get all metrics', () => {
    registry.get('op1');
    registry.get('op2');

    const metrics = registry.getAllMetrics();
    expect(metrics).toHaveProperty('op1');
    expect(metrics).toHaveProperty('op2');
  });

  it('should reset all breakers', async () => {
    const breaker1 = registry.get('op1', { failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('error'));

    try {
      await breaker1.execute(fn);
    } catch {}
    expect(breaker1.getState()).toBe('OPEN');

    registry.resetAll();
    expect(breaker1.getState()).toBe('CLOSED');
  });

  it('should destroy all breakers', () => {
    const breaker = registry.get('op1', { resetTimeoutMs: 100 });
    registry.destroy();

    const all = registry.getAll();
    expect(all.size).toBe(0);
  });
});
