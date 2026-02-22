/**
 * Database Retry Strategy
 * 
 * Implements exponential backoff with jitter to handle transient database errors.
 * Follows AWS SDK retry patterns and best practices.
 */

import { classifyError, shouldRetry, getSuggestedWaitMs } from './error-classifier';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Base delay in milliseconds (default: 100) */
  baseDelayMs?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;

  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;

  /** Add random jitter to delay (default: true) */
  useJitter?: boolean;

  /** Jitter factor: delay * (1 ± jitterFactor) (default: 0.1 = 10%) */
  jitterFactor?: number;

  /** Timeout for individual query attempt in milliseconds (default: 30000) */
  timeoutMs?: number;

  /** Custom retry predicate (return true to retry this error) */
  shouldRetryFn?: (error: any, attempt: number) => boolean;

  /** Callback for each retry attempt */
  onRetry?: (error: any, attempt: number, nextDelayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
  totalDelayMs: number;
  lastError?: any;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  useJitter: true,
  jitterFactor: 0.1,
  timeoutMs: 30000,
  shouldRetryFn: shouldRetry,
  onRetry: () => {},
};

/**
 * Calculate delay for retry with exponential backoff and optional jitter
 * 
 * Formula: baseDelay * (multiplier ^ attempt)
 * With jitter: delay * (1 ± jitterFactor * random)
 */
export function calculateRetryDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  // Exponential backoff
  let delay = opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt);

  // Cap at maximum delay
  delay = Math.min(delay, opts.maxDelayMs);

  // Add jitter if enabled
  if (opts.useJitter) {
    const jitterAmount = delay * opts.jitterFactor;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount; // ±jitterAmount
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}

/**
 * Execute a function with automatic retry on transient errors
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  let totalDelayMs = 0;
  let attempt = 0;

  for (attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Execute function with timeout
      const timeoutPromise = new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error('Query timeout')),
          opts.timeoutMs
        )
      );

      const result = await Promise.race([fn(), timeoutPromise]);

      return {
        success: true,
        data: result,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;
      const shouldRetryError = opts.shouldRetryFn
        ? opts.shouldRetryFn(error, attempt)
        : shouldRetry(error);

      // Don't retry on permanent errors
      if (!shouldRetryError || attempt === opts.maxRetries) {
        return {
          success: false,
          error,
          attempts: attempt + 1,
          totalDelayMs,
          lastError: error,
        };
      }

      // Calculate delay before next attempt
      const delayMs = calculateRetryDelay(attempt, opts);
      totalDelayMs += delayMs;

      // Call retry callback
      opts.onRetry(error, attempt + 1, delayMs);

      // Wait before retrying
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // This shouldn't be reached, but just in case
  return {
    success: false,
    error: lastError,
    attempts: attempt,
    totalDelayMs,
    lastError,
  };
}

/**
 * Retry a database query function
 * 
 * @param queryFn - Async function that performs the query
 * @param options - Retry configuration options
 * @returns Query result or throws last error
 */
export async function retryQuery<T>(
  queryFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await executeWithRetry(queryFn, options);

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

/**
 * Create a retry wrapper for a query function
 * 
 * Example:
 * ```ts
 * const getMarketsWithRetry = wrapWithRetry(
 *   () => getSupabase().from('markets').select('*'),
 *   { maxRetries: 5 }
 * );
 * const markets = await getMarketsWithRetry();
 * ```
 */
export function wrapWithRetry<Args extends any[], T>(
  fn: (...args: Args) => Promise<T>,
  options: RetryOptions = {}
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    return retryQuery(() => fn(...args), options);
  };
}

/**
 * Retry options for different scenarios
 */
export const PRESET_RETRY_OPTIONS = {
  /**
   * Aggressive retries for critical reads (e.g., market data)
   */
  aggressiveRead: {
    maxRetries: 5,
    baseDelayMs: 50,
    maxDelayMs: 10000,
    backoffMultiplier: 1.5,
  } as RetryOptions,

  /**
   * Standard retries for normal operations
   */
  normal: {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * Quick retries for time-sensitive operations (e.g., WebSocket updates)
   */
  quick: {
    maxRetries: 2,
    baseDelayMs: 50,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * Slow retries for writes (e.g., trade insertion)
   */
  slowWrite: {
    maxRetries: 4,
    baseDelayMs: 200,
    maxDelayMs: 60000,
    backoffMultiplier: 2.5,
    useJitter: true,
  } as RetryOptions,

  /**
   * Very aggressive retries for critical operations
   */
  critical: {
    maxRetries: 7,
    baseDelayMs: 100,
    maxDelayMs: 120000,
    backoffMultiplier: 2,
    useJitter: true,
  } as RetryOptions,

  /**
   * No retries (execute once)
   */
  noRetry: {
    maxRetries: 0,
  } as RetryOptions,
};
