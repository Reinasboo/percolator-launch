/**
 * IMPLEMENTATION GUIDE: Using Standardized Error Classes
 * 
 * This file demonstrates how to use the new error handling system
 * in your API routes. It provides patterns for common scenarios.
 * 
 * Usage: Use these patterns when creating or updating routes in /src/routes/
 */

import type { Context } from "hono";
import {
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
  InternalServerError,
} from "../lib/errors.js";
import { catchAsync } from "../middleware/errorHandler.js";

// ============================================================================
// PATTERN 1: Input Validation
// ============================================================================
/**
 * Validate and sanitize route parameters
 * Throw BadRequestError or ValidationError for invalid input
 */
function validateSlabAddress(slab: string): string {
  if (!slab || slab.length < 32 || slab.length > 44) {
    throw new BadRequestError("Invalid slab address format", {
      received: slab.slice(0, 20) + "...",
      expected: "32-44 character base58 string",
    });
  }
  return slab;
}

/**
 * Validate multiple fields at once
 * Collect all errors before throwing for better UX
 */
function validateCreateMarketInput(data: unknown): {
  mint: string;
  leverage: number;
} {
  const errors: Record<string, string[]> = {};

  if (typeof data !== "object" || !data) {
    throw new BadRequestError("Request body must be a JSON object");
  }

  const obj = data as Record<string, unknown>;

  // Validate mint
  if (!obj.mint || typeof obj.mint !== "string") {
    errors.mint = ["Mint address is required"];
  } else if (obj.mint.length < 32 || obj.mint.length > 44) {
    errors.mint = ["Invalid base58 format (32-44 characters)"];
  }

  // Validate leverage
  if (!obj.leverage || typeof obj.leverage !== "number") {
    errors.leverage = ["Leverage must be a number"];
  } else if (obj.leverage < 1 || obj.leverage > 20) {
    errors.leverage = ["Leverage must be between 1 and 20"];
  }

  // Throw all validation errors together
  if (Object.keys(errors).length > 0) {
    throw new ValidationError("Request validation failed", errors);
  }

  return {
    mint: obj.mint as string,
    leverage: obj.leverage as number,
  };
}

// ============================================================================
// PATTERN 2: Handle Resource Not Found
// ============================================================================
/**
 * When querying a resource by ID, throw NotFoundError if not found
 */
async function fetchMarketOrThrow(slabAddress: string) {
  // Your database query here
  const market = null; // simulate not found

  if (!market) {
    throw new NotFoundError("Market");
  }

  return market;
}

// ============================================================================
// PATTERN 3: Handle Service Dependencies
// ============================================================================
/**
 * When a dependency (DB, RPC, etc.) fails, throw ServiceUnavailableError
 */
async function fetchDataWithFallback(slabAddress: string) {
  try {
    // Try primary data source
    return await fetch(`https://primary-api.com/data/${slabAddress}`);
  } catch (primaryError) {
    try {
      // Try fallback data source
      return await fetch(`https://fallback-api.com/data/${slabAddress}`);
    } catch (fallbackError) {
      throw new ServiceUnavailableError(
        "Data Service",
        "Both primary and fallback data sources are temporarily unavailable"
      );
    }
  }
}

// ============================================================================
// PATTERN 4: Async Route Handler with Error Handling
// ============================================================================
/**
 * Use catchAsync wrapper for async route handlers
 * It automatically catches and standardizes all errors
 */
export function exampleRoutes() {
  return new Hono()
    .get("/markets/:slab", catchAsync(async (c: Context) => {
      // 1. Validate input
      const slab = validateSlabAddress(c.req.param("slab"));

      // 2. Check for resource
      const market = await fetchMarketOrThrow(slab);

      // 3. Return success response
      return c.json(market);
    }));
}

// ============================================================================
// PATTERN 5: Explicit Error Handling with Detailed Context
// ============================================================================
/**
 * For complex operations, catch errors and add contextual information
 */
export async function complexMarketOperation(slabAddress: string) {
  try {
    const slab = validateSlabAddress(slabAddress);
    const market = await fetchMarketOrThrow(slab);

    // Your business logic here
    return market;
  } catch (error) {
    // ApiError instances pass through unchanged
    if (error instanceof (BadRequestError || NotFoundError)) {
      throw error;
    }

    // Convert other errors with context
    if (error instanceof Error) {
      throw new InternalServerError(error.message, {
        context: "complexMarketOperation",
        slabAddress: slabAddress.slice(0, 20) + "...",
      });
    }

    // Unknown error type
    throw new InternalServerError("Unknown error occurred");
  }
}

// ============================================================================
// PATTERN 6: Route Handler Without catchAsync
// ============================================================================
/**
 * For sync or simpler routes, you can handle errors manually
 * The global errorHandler middleware will still catch any uncaught errors
 */
export function simpleRoutes() {
  return new Hono()
    .get("/health", (c) => {
      try {
        const slab = c.req.query("slab");

        if (!slab) {
          throw new BadRequestError("slab query parameter is required");
        }

        validateSlabAddress(slab);

        return c.json({ status: "ok", slab });
      } catch (error) {
        // Either re-throw for global handler or handle here
        throw error;
      }
    });
}

// ============================================================================
// PATTERN 7: Proper HTTP Status Codes
// ============================================================================
/**
 * Maps business logic errors to appropriate HTTP statuses
 */
export async function demoEndpoint(c: Context) {
  const input = await c.req.json().catch(() => {
    throw new BadRequestError("Invalid JSON in request body"); // 400
  });

  validateCreateMarketInput(input); // Throws ValidationError (400)

  const mint = (input as Record<string, unknown>).mint as string;
  const market = await fetchMarketOrThrow(mint); // Throws NotFoundError (404)

  try {
    await fetchDataWithFallback(mint); // Throws ServiceUnavailableError (503)
  } catch (error) {
    throw error;
  }

  return c.json({ success: true });
}

// ============================================================================
// ERROR CODES REFERENCE
// ============================================================================
/**
 * Use these error codes in your application for consistency:
 * 
 * 400 Bad Request
 * - Invalid input format (malformed JSON, invalid base58, etc.)
 * - Validation: field out of range, missing required field
 * - Use: BadRequestError, ValidationError
 * 
 * 401 Unauthorized
 * - Missing/invalid API key or auth token
 * - Use: UnauthorizedError
 * 
 * 403 Forbidden
 * - User authenticated but not authorized for this operation
 * - Use: ForbiddenError
 * 
 * 404 Not Found
 * - Requested resource doesn't exist
 * - Use: NotFoundError
 * 
 * 429 Too Many Requests
 * - Rate limit exceeded
 * - Use: RateLimitError
 * 
 * 500 Internal Server Error
 * - Unexpected server error
 * - Use: InternalServerError
 * 
 * 503 Service Unavailable
 * - Dependency unavailable (Supabase, RPC, etc.)
 * - Use: ServiceUnavailableError
 */

// ============================================================================
// TESTING ERRORS
// ============================================================================
/**
 * When testing routes, verify error responses:
 * 
 * const res = await app.request("/markets/invalid", { method: "GET" });
 * expect(res.status).toBe(400);
 * 
 * const data = await res.json();
 * expect(data.error.code).toBe("BAD_REQUEST");
 * expect(data.error.message).toContain("Invalid");
 * expect(data.error.requestId).toBeDefined();
 * expect(data.error.timestamp).toBeDefined();
 */
