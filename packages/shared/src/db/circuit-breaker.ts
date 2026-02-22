/**
 * Circuit Breaker Pattern for Database Operations
 * 
 * Prevents cascading failures by temporarily halting requests to a failing service.
 * States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 */

import { createLogger } from '../logger';

const logger = createLogger('db:circuit-breaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;

  /** Number of successes to close circuit from HALF_OPEN (default: 2) */
  successThreshold?: number;

  /** Time in ms before trying again in OPEN state (default: 60000) */
  resetTimeoutMs?: number;

  /** Time in ms before considering state change (default: 300000) */
  monitoringWindowMs?: number;

  /** Callback when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChangeTime: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Circuit breaker for database operations
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastStateChangeTime = Date.now();
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private resetTimeout?: NodeJS.Timeout;

  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      resetTimeoutMs: options.resetTimeoutMs ?? 60000,
      monitoringWindowMs: options.monitoringWindowMs ?? 300000,
      onStateChange: options.onStateChange ?? (() => {}),
    };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChangeTime: this.lastStateChangeTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Execute a function if circuit allows
   * 
   * @throws Error if circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // If circuit is OPEN, check if we should try again
    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure < this.options.resetTimeoutMs) {
        throw new Error(
          `Circuit breaker is OPEN. Service unavailable. Retry in ${
            this.options.resetTimeoutMs - timeSinceLastFailure
          }ms`
        );
      }
      // Try transitioning to HALF_OPEN
      this.transitionTo('HALF_OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful request
   */
  private onSuccess(): void {
    this.successCount++;
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.options.successThreshold) {
        logger.info('Circuit breaker recovered', {
          successCount: this.successCount,
          threshold: this.options.successThreshold,
        });
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  private onFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.successCount = 0; // Reset success count

    if (this.state === 'CLOSED') {
      if (this.failureCount >= this.options.failureThreshold) {
        logger.warn('Circuit breaker opening', {
          failureCount: this.failureCount,
          threshold: this.options.failureThreshold,
        });
        this.transitionTo('OPEN');
      }
    } else if (this.state === 'HALF_OPEN') {
      logger.warn('Circuit breaker re-opening', {
        failureInHalfOpen: true,
      });
      this.transitionTo('OPEN');
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeTime = Date.now();

    logger.info('Circuit breaker state change', { from: oldState, to: newState });
    this.options.onStateChange(oldState, newState);

    // Schedule reset from OPEN to HALF_OPEN
    if (newState === 'OPEN') {
      if (this.resetTimeout) clearTimeout(this.resetTimeout);
      this.resetTimeout = setTimeout(() => {
        logger.info('Circuit breaker attempting recovery', { currentState: this.state });
        if (this.state === 'OPEN') {
          this.transitionTo('HALF_OPEN');
        }
      }, this.options.resetTimeoutMs);
    }
  }

  /**
   * Reset circuit to CLOSED state
   */
  reset(): void {
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.transitionTo('CLOSED');
  }

  /**
   * Force circuit to OPEN (for testing or emergency use)
   */
  open(): void {
    this.transitionTo('OPEN');
  }

  /**
   * Destroy the circuit breaker (cleanup)
   */
  destroy(): void {
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
  }
}

/**
 * Circuit breaker registry for different database operations
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a specific operation
   */
  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(options));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Destroy all circuit breakers
   */
  destroy(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

// Global circuit breaker registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
