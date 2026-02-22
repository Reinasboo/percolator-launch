/**
 * Error Classifier Tests
 */

import { describe, it, expect } from 'vitest';
import {
  classifyError,
  shouldRetry,
  getSuggestedWaitMs,
  ClassifiedError,
} from '../../src/db/error-classifier';

describe('Error Classifier', () => {
  describe('retryable PostgreSQL errors', () => {
    it('should classify connection refused as retryable', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
      expect(classified.severity).toBe('transient');
      expect(classified.code).toBe('CONNECTION_REFUSED');
    });

    it('should classify connection timeout as retryable', () => {
      const error = new Error('ETIMEDOUT: Connection timeout');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
      expect(classified.severity).toBe('transient');
      expect(classified.code).toBe('CONNECTION_TIMEOUT');
    });

    it('should classify connection reset as retryable', () => {
      const error = new Error('ECONNRESET: Connection reset');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
      expect(classified.severity).toBe('transient');
      expect(classified.code).toBe('CONNECTION_RESET');
    });

    it('should classify pool exhausted as retryable', () => {
      const error: any = {
        code: '57P03',
        message: 'cannot connect now',
      };
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
      expect(classified.severity).toBe('transient');
    });

    it('should classify too many connections as retryable', () => {
      const error: any = {
        code: 'POOL_EXHAUSTED',
        message: 'too many connections for role',
      };
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
    });

    it('should classify timeout as retryable', () => {
      const error = new Error('Query execution timeout after 30000ms');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
      expect(classified.code).toBe('QUERY_TIMEOUT');
    });
  });

  describe('permanent PostgreSQL errors', () => {
    it('should classify unique violation as permanent', () => {
      const error: any = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      };
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(false);
      expect(classified.severity).toBe('permanent');
    });

    it('should classify not null violation as permanent', () => {
      const error: any = {
        code: '23502',
        message: 'null value in column violates not-null constraint',
      };
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(false);
      expect(classified.severity).toBe('permanent');
    });

    it('should classify undefined column as permanent', () => {
      const error: any = {
        code: '42703',
        message: 'column "invalid_col" does not exist',
      };
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(false);
      expect(classified.severity).toBe('permanent');
    });

    it('should classify syntax error as permanent', () => {
      const error: any = {
        code: '42601',
        message: 'syntax error',
      };
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(false);
      expect(classified.severity).toBe('permanent');
    });

    it('should classify authentication error as permanent', () => {
      const error = new Error('Unauthorized: Invalid authentication');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(false);
      expect(classified.severity).toBe('permanent');
    });
  });

  describe('helper functions', () => {
    it('shouldRetry should return true for retryable errors', () => {
      const error = new Error('ECONNREFUSED');
      expect(shouldRetry(error)).toBe(true);
    });

    it('shouldRetry should return false for permanent errors', () => {
      const error: any = {
        code: '23505',
        message: 'unique violation',
      };
      expect(shouldRetry(error)).toBe(false);
    });

    it('getSuggestedWaitMs should return reasonable delays', () => {
      const connError = new Error('ECONNREFUSED');
      const connWait = getSuggestedWaitMs(connError);
      expect(connWait).toBeGreaterThan(0);
      expect(connWait).toBeLessThan(2000);

      const poolError: any = {
        code: '57P03',
        message: 'too many connections',
      };
      const poolWait = getSuggestedWaitMs(poolError);
      expect(poolWait).toBeGreaterThan(connWait); // Pool errors should wait longer
    });
  });

  describe('edge cases', () => {
    it('should handle null error', () => {
      const classified = classifyError(null);
      expect(classified).toBeDefined();
      expect(classified.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle undefined error', () => {
      const classified = classifyError(undefined);
      expect(classified).toBeDefined();
    });

    it('should handle error without message', () => {
      const classified = classifyError({});
      expect(classified).toBeDefined();
    });

    it('should handle unknown PostgreSQL codes as retryable', () => {
      const error: any = {
        code: '99XXX', // Unknown code
        message: 'Unknown error',
      };
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
      expect(classified.severity).toBe('transient');
    });
  });

  describe('network error detection', () => {
    it('should classify network errors as retryable', () => {
      const error = new Error('Network error: getaddrinfo ENOTFOUND db.example.com');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
      expect(classified.code).toBe('NETWORK_ERROR');
    });

    it('should classify EPIPE as retryable', () => {
      const error = new Error('write EPIPE');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
    });

    it('should classify host unreachable as retryable', () => {
      const error = new Error('EHOSTUNREACH: No route to host');
      const classified = classifyError(error);

      expect(classified.isRetryable).toBe(true);
    });
  });
});
