/**
 * Database Error Classification
 * 
 * Classifies database errors as retryable or permanent.
 * Helps determine which errors should trigger retry logic.
 */

export interface ClassifiedError {
  isRetryable: boolean;
  severity: 'transient' | 'permanent' | 'fatal';
  code: string;
  message: string;
  suggestedWaitMs?: number;
}

/**
 * Transient error codes that should be retried
 */
const RETRYABLE_PG_CODES = new Set([
  '08P01', // protocol_violation
  'cannot connect to server', // Connection refused
  'timeout', // Query timeout
  '08006', // connection failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08000', // connection_exception
  '57P03', // cannot_connect_now
  '42P01', // undefined_table (can happen during schema migrations)
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'read ECONNRESET',
  'write ECONNRESET',
]);

/**
 * Permanent error codes that should NOT be retried
 */
const PERMANENT_PG_CODES = new Set([
  '23505', // unique_violation - duplicate key
  '23502', // integrity_constraint_violation - not null violation
  '23514', // check_violation
  '42703', // undefined_column
  '42601', // syntax_error
  '42P07', // duplicate_table
  '3F000', // invalid_schema_name
  '28P01', // invalid_password
  '28000', // invalid_authorization_specification
  '42501', // insufficient_privilege
]);

/**
 * Classify a database error as retryable or permanent
 */
export function classifyError(error: any): ClassifiedError {
  // Default classification
  const base: ClassifiedError = {
    isRetryable: false,
    severity: 'permanent',
    code: 'UNKNOWN_ERROR',
    message: String(error),
  };

  if (!error) return base;

  // Handle PostgreSQL errors
  if (error.code) {
    const code = String(error.code).toUpperCase();
    
    if (PERMANENT_PG_CODES.has(code)) {
      return {
        ...base,
        isRetryable: false,
        severity: 'permanent',
        code,
        message: error.message || `PostgreSQL error: ${code}`,
      };
    }

    if (RETRYABLE_PG_CODES.has(code)) {
      return {
        ...base,
        isRetryable: true,
        severity: 'transient',
        code,
        message: error.message || `PostgreSQL error: ${code}`,
        suggestedWaitMs: 100, // Start with 100ms for transient errors
      };
    }

    // Unknown PostgreSQL code - treat as retryable
    if (code.match(/^[0-9]{5}$/)) {
      return {
        ...base,
        isRetryable: true,
        severity: 'transient',
        code,
        message: error.message || `PostgreSQL error: ${code}`,
        suggestedWaitMs: 50,
      };
    }
  }

  // Handle Node.js network errors
  const message = error.message || String(error);
  if (message.includes('TIMEOUT') || message.includes('timeout')) {
    return {
      ...base,
      isRetryable: true,
      severity: 'transient',
      code: 'QUERY_TIMEOUT',
      message: 'Query execution timeout',
      suggestedWaitMs: 200,
    };
  }

  if (message.includes('ECONNREFUSED')) {
    return {
      ...base,
      isRetryable: true,
      severity: 'transient',
      code: 'CONNECTION_REFUSED',
      message: 'Database connection refused',
      suggestedWaitMs: 500,
    };
  }

  if (message.includes('ECONNRESET') || message.includes('EPIPE')) {
    return {
      ...base,
      isRetryable: true,
      severity: 'transient',
      code: 'CONNECTION_RESET',
      message: 'Database connection reset',
      suggestedWaitMs: 300,
    };
  }

  if (message.includes('ETIMEDOUT')) {
    return {
      ...base,
      isRetryable: true,
      severity: 'transient',
      code: 'CONNECTION_TIMEOUT',
      message: 'Database connection timeout',
      suggestedWaitMs: 500,
    };
  }

  if (
    message.includes('pool timeout') ||
    message.includes('connection pool') ||
    message.includes('no more connections')
  ) {
    return {
      ...base,
      isRetryable: true,
      severity: 'transient',
      code: 'POOL_EXHAUSTED',
      message: 'Connection pool exhausted',
      suggestedWaitMs: 1000, // Higher wait for pool exhaustion
    };
  }

  if (message.includes('Network error') || message.includes('network')) {
    return {
      ...base,
      isRetryable: true,
      severity: 'transient',
      code: 'NETWORK_ERROR',
      message: 'Network error',
      suggestedWaitMs: 500,
    };
  }

  // Supabase-specific error messages
  if (message.includes('too many connections')) {
    return {
      ...base,
      isRetryable: true,
      severity: 'transient',
      code: 'TOO_MANY_CONNECTIONS',
      message: 'Database has too many connections',
      suggestedWaitMs: 1500,
    };
  }

  // Auth errors are permanent
  if (
    message.includes('Unauthorized') ||
    message.includes('Forbidden') ||
    message.includes('authentication')
  ) {
    return {
      ...base,
      isRetryable: false,
      severity: 'permanent',
      code: 'AUTH_ERROR',
      message: 'Authentication error',
    };
  }

  // By default, classify as retryable but with lower priority
  // (assume it might be transient)
  return {
    ...base,
    isRetryable: true,
    severity: 'transient',
    code: 'UNKNOWN_TRANSIENT',
    message,
    suggestedWaitMs: 100,
  };
}

/**
 * Check if an error should be retried
 */
export function shouldRetry(error: any): boolean {
  return classifyError(error).isRetryable;
}

/**
 * Get suggested wait time before retry for this error
 */
export function getSuggestedWaitMs(error: any): number {
  const classified = classifyError(error);
  return classified.suggestedWaitMs || 100;
}
