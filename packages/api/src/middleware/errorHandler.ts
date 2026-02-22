/**
 * Global Error Handler Middleware
 * Catches and standardizes all errors across API routes
 */

import type { Context, Next } from "hono";
import { createLogger } from "@percolator/shared";
import {
  isApiError,
  toApiError,
  ApiError,
  type ApiErrorResponse,
} from "../lib/errors.js";

const logger = createLogger("api:error-handler");

/**
 * Generate a request ID for error tracking in logs
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Global error handler middleware
 * Should be applied early in the middleware stack to catch all errors
 *
 * Usage:
 *   app.use("*", errorHandler())
 */
export function errorHandler() {
  return async (c: Context, next: Next) => {
    const requestId = generateRequestId();
    c.set("requestId", requestId);

    try {
      await next();

      // If response status is 4xx or 5xx but no error was thrown,
      // it likely came from another middleware. Don't double-wrap it.
      if (c.res.status >= 400) {
        // Response is already set by another handler
        return;
      }
    } catch (error) {
      // Convert error to standardized ApiError
      const apiError = toApiError(error);

      // Log the error with context
      const logLevel = apiError.statusCode >= 500 ? "error" : "warn";
      const logContext = {
        requestId,
        method: c.req.method,
        path: c.req.path,
        statusCode: apiError.statusCode,
        errorCode: apiError.code,
        message: apiError.message,
        ...(apiError.details && { details: apiError.details }),
        ...(error instanceof Error && error.stack && { stack: error.stack }),
      };

      if (logLevel === "error") {
        logger.error("Request failed with error", logContext);
      } else {
        logger.warn("Request failed", logContext);
      }

      // Send standardized error response
      const response: ApiErrorResponse = apiError.toResponse(requestId);
      return c.json(response, { status: apiError.statusCode });
    }
  };
}

/**
 * Error handling helper for async route handlers
 * Wraps route handlers to catch and standardize errors
 *
 * Usage:
 *   app.get("/path", (c) => catchAsync(async (c) => {
 *     // route logic
 *   })(c))
 */
export function catchAsync(
  handler: (c: Context) => Promise<Response>
): (c: Context) => Promise<Response> {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      const requestId = c.get("requestId") as string;
      const apiError = toApiError(error);

      const logContext = {
        requestId,
        method: c.req.method,
        path: c.req.path,
        statusCode: apiError.statusCode,
        errorCode: apiError.code,
        message: apiError.message,
      };

      if (apiError.statusCode >= 500) {
        logger.error("Async handler error", logContext);
      } else {
        logger.warn("Async handler error", logContext);
      }

      const response: ApiErrorResponse = apiError.toResponse(requestId);
      return c.json(response, { status: apiError.statusCode });
    }
  };
}
