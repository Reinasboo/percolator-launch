/**
 * Retry Strategy Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateRetryDelay,
  executeWithRetry,
  retryQuery,
  wrapWithRetry,
  PRESET_RETRY_OPTIONS,
  DEFAULT_RETRY_OPTIONS,
  RetryOptions,
} from '../../src/db/retry-strategy';

describe('Retry Strategy', () => {
  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const opts: RetryOptions = {
        baseDelayMs: 100,
        backoffMultiplier: 2,
        useJitter: false,
      };

      expect(calculateRetryDelay(0, opts)).toBe(100); // 100 * 2^0
      expect(calculateRetryDelay(1, opts)).toBe(200); // 100 * 2^1
      expect(calculateRetryDelay(2, opts)).toBe(400); // 100 * 2^2
      expect(calculateRetryDelay(3, opts)).toBe(800); // 100 * 2^3
    });

    it('should cap delay at maxDelayMs', () => {
      const opts: RetryOptions = {
        baseDelayMs: 100,
        backoffMultiplier: 10,
        maxDelayMs: 1000,
        useJitter: false,
      };

      expect(calculateRetryDelay(5, opts)).toBeLessThanOrEqual(1000);
    });

    it('should add jitter when enabled', () => {
      const opts: RetryOptions = {
        baseDelayMs: 100,
        backoffMultiplier: 2,
        useJitter: true,
        jitterFactor: 0.1,
      };

      const delays = Array.from({ length: 10 }, (_, i) =>
        calculateRetryDelay(1, opts)
      );

      // With jitter, delays should vary between 100 * 0.9 = 90 and 100 * 1.1 = 110 (approximately)
      // Due to exponential backoff, we get 200 ± 20%
      const baseWithBackoff = 100 * Math.pow(2, 1);
      const allWithinRange = delays.every(
        (d) => d >= baseWithBackoff * 0.8 && d <= baseWithBackoff * 1.2
      );
      expect(allWithinRange).toBe(true);

      // Delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should not add negative delays', () => {
      const opts: RetryOptions = {
        baseDelayMs: 1,
        backoffMultiplier: 1,
        useJitter: true,
        jitterFactor: 1,
      };

      const delay = calculateRetryDelay(0, opts);
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await executeWithRetry(fn, { maxRetries: 3 });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelayMs).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        useJitter: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after maxRetries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await executeWithRetry(fn, { maxRetries: 2 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on permanent errors', async () => {
      const error: any = {
        code: '23505',
        message: 'duplicate key',
      };
      const fn = vi.fn().mockRejectedValue(error);

      const result = await executeWithRetry(fn, { maxRetries: 3 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should accumulate delay time', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 50,
        useJitter: false,
      });

      expect(result.totalDelayMs).toBeGreaterThan(0);
      // Should be at least 50ms (first retry) + 100ms (second retry) = 150ms
      expect(result.totalDelayMs).toBeGreaterThanOrEqual(150);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      await executeWithRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        useJitter: false,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
    });

    it('should respect custom shouldRetryFn', async () => {
      const shouldRetryFn = vi.fn().mockReturnValue(false);
      const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await executeWithRetry(fn, {
        maxRetries: 3,
        shouldRetryFn,
      });

      expect(shouldRetryFn).toHaveBeenCalled();
      expect(fn).toHaveBeenCalledTimes(1); // No retries because shouldRetryFn returned false
    });

    it('should timeout after timeoutMs', async () => {
      const fn = vi.fn(() => new Promise(() => {})); // Never resolves

      const result = await executeWithRetry(fn, {
        maxRetries: 0,
        timeoutMs: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('retryQuery', () => {
    it('should return data on success', async () => {
      const fn = vi.fn().mockResolvedValue({ id: 1, name: 'test' });

      const result = await retryQuery(fn);

      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should throw on permanent error', async () => {
      const error: any = {
        code: '42703',
        message: 'undefined column',
      };
      const fn = vi.fn().mockRejectedValue(error);

      await expect(retryQuery(fn)).rejects.toBe(error);
    });

    it('should retry transient errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ created: true });

      const result = await retryQuery(fn, { maxRetries: 3 });

      expect(result).toEqual({ created: true });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('wrapWithRetry', () => {
    it('should create wrapped function', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      const wrapped = wrapWithRetry(fn, { maxRetries: 2 });

      const result = await wrapped();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to wrapped function', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const wrapped = wrapWithRetry((id: number, name: string) =>
        fn(id, name)
      );

      await wrapped(42, 'test');

      expect(fn).toHaveBeenCalledWith(42, 'test');
    });
  });

  describe('preset retry options', () => {
    it('should have aggressiveRead preset', () => {
      expect(PRESET_RETRY_OPTIONS.aggressiveRead.maxRetries).toBe(5);
      expect(PRESET_RETRY_OPTIONS.aggressiveRead.maxDelayMs).toBe(10000);
    });

    it('should have normal preset', () => {
      expect(PRESET_RETRY_OPTIONS.normal.maxRetries).toBe(3);
    });

    it('should have quick preset', () => {
      expect(PRESET_RETRY_OPTIONS.quick.maxRetries).toBe(2);
      expect(PRESET_RETRY_OPTIONS.quick.maxDelayMs).toBe(5000);
    });

    it('should have slowWrite preset', () => {
      expect(PRESET_RETRY_OPTIONS.slowWrite.maxRetries).toBe(4);
      expect(PRESET_RETRY_OPTIONS.slowWrite.maxDelayMs).toBe(60000);
    });

    it('should have noRetry preset', () => {
      expect(PRESET_RETRY_OPTIONS.noRetry.maxRetries).toBe(0);
    });
  });

  describe('default options', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_OPTIONS.baseDelayMs).toBe(100);
      expect(DEFAULT_RETRY_OPTIONS.maxDelayMs).toBe(30000);
      expect(DEFAULT_RETRY_OPTIONS.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_OPTIONS.useJitter).toBe(true);
    });
  });
});
