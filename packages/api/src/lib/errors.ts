/**
 * API Error Classes and Response Types
 * Provides standardized error handling across all API endpoints
 */

/** HTTP status codes */
export enum HttpStatus {
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  TooManyRequests = 429,
  InternalServerError = 500,
  ServiceUnavailable = 503,
}

/** Standard API error response format */
export interface ApiErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

/** Success response format for consistency */
export interface ApiSuccessResponse<T> {
  data: T;
  timestamp: string;
}

/**
 * Base API Error class with standardized structure
 * All API errors should inherit from this
 */
export class ApiError extends Error {
  constructor(
    public statusCode: HttpStatus,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toResponse(requestId?: string): ApiErrorResponse {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        timestamp: new Date().toISOString(),
        requestId,
        details: this.details,
      },
    };
  }
}

/**
 * 400 Bad Request - Invalid input or malformed request
 */
export class BadRequestError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(HttpStatus.BadRequest, "BAD_REQUEST", message, details);
    this.name = "BadRequestError";
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 Unauthorized - Missing or invalid authentication
 */
export class UnauthorizedError extends ApiError {
  constructor(message = "Missing or invalid authentication") {
    super(HttpStatus.Unauthorized, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
export class ForbiddenError extends ApiError {
  constructor(message = "Access denied") {
    super(HttpStatus.Forbidden, "FORBIDDEN", message);
    this.name = "ForbiddenError";
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    const message = `${resource} not found`;
    super(HttpStatus.NotFound, "NOT_FOUND", message, { resource });
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends ApiError {
  constructor(retryAfterSeconds?: number) {
    const message = retryAfterSeconds
      ? `Rate limit exceeded. Retry after ${retryAfterSeconds}s`
      : "Rate limit exceeded";
    super(
      HttpStatus.TooManyRequests,
      "RATE_LIMIT_EXCEEDED",
      message,
      retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined
    );
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalServerError extends ApiError {
  constructor(message = "Internal server error", details?: Record<string, unknown>) {
    super(HttpStatus.InternalServerError, "INTERNAL_SERVER_ERROR", message, details);
    this.name = "InternalServerError";
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 503 Service Unavailable - Dependency unavailable (DB, RPC, etc.)
 */
export class ServiceUnavailableError extends ApiError {
  constructor(service: string, message?: string) {
    const msg = message || `${service} service unavailable`;
    super(HttpStatus.ServiceUnavailable, "SERVICE_UNAVAILABLE", msg, { service });
    this.name = "ServiceUnavailableError";
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Validation error for structured input validation failures
 */
export class ValidationError extends BadRequestError {
  constructor(
    message: string,
    public fields: Record<string, string[]>
  ) {
    super(message, { fields });
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Convert unknown error to ApiError for consistent response format
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new BadRequestError("Invalid JSON in request body");
  }

  if (error instanceof RangeError) {
    return new BadRequestError("Value out of range");
  }

  const message = error instanceof Error ? error.message : String(error);
  return new InternalServerError(
    "An unexpected error occurred",
    { originalError: message }
  );
}
