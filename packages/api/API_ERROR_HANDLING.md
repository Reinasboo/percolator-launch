# API Error Handling Guide

This document explains the standardized error handling system used across the Percolator API.

## Overview

All API endpoints now use a standardized error response format with custom error classes. This provides:

- **Consistency**: All errors follow the same structure
- **Type Safety**: TypeScript error classes with proper inheritance
- **Better Debugging**: Request IDs and detailed logging
- **Clear Semantics**: Specific error codes for different failure modes

## Error Response Format

All error responses follow this standard format:

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "timestamp": "2026-02-22T10:30:45.123Z",
    "requestId": "req_1234567890_abc123",
    "details": {
      "field": "additional context"
    }
  }
}
```

## Available Error Classes

### BadRequestError (400)

Invalid input or malformed request.

```typescript
import { BadRequestError } from "@percolator/api/lib/errors";

throw new BadRequestError("Slab address must be a valid base58 string", {
  field: "slab",
  value: "invalid"
});
```

### ValidationError (400)

Structured validation failures with field-level errors.

```typescript
import { ValidationError } from "@percolator/api/lib/errors";

throw new ValidationError("Validation failed", {
  email: ["Invalid email format"],
  age: ["Must be 18 or older"]
});
```

### UnauthorizedError (401)

Missing or invalid authentication.

```typescript
import { UnauthorizedError } from "@percolator/api/lib/errors";

throw new UnauthorizedError("API key expired");
```

### ForbiddenError (403)

Authenticated but not authorized for the resource.

```typescript
import { ForbiddenError } from "@percolator/api/lib/errors";

throw new ForbiddenError("You do not have permission to access this market");
```

### NotFoundError (404)

Resource not found.

```typescript
import { NotFoundError } from "@percolator/api/lib/errors";

if (!market) {
  throw new NotFoundError("Market");
}
```

### RateLimitError (429)

Rate limit exceeded.

```typescript
import { RateLimitError } from "@percolator/api/lib/errors";

throw new RateLimitError(60); // Retry after 60 seconds
```

### ServiceUnavailableError (503)

Dependency unavailable (database, RPC, etc.).

```typescript
import { ServiceUnavailableError } from "@percolator/api/lib/errors";

throw new ServiceUnavailableError("Database");
// or with custom message
throw new ServiceUnavailableError("RPC", "Helius RPC is overloaded");
```

### InternalServerError (500)

Unexpected server error.

```typescript
import { InternalServerError } from "@percolator/api/lib/errors";

throw new InternalServerError("Failed to fetch market data", {
  originalError: error.message
});
```

## Using Errors in Routes

### Pattern 1: Direct Validation

```typescript
import { BadRequestError, NotFoundError } from "@percolator/api/lib/errors";
import { PublicKey } from "@solana/web3.js";

app.get("/markets/:slab", (c) => {
  const slab = c.req.param("slab");

  // Validate input
  if (!slab) {
    throw new BadRequestError("Slab address is required");
  }

  // Validate format
  try {
    new PublicKey(slab);
  } catch {
    throw new BadRequestError("Invalid slab address format");
  }

  // Fetch and check existence
  const market = await db.getMarket(slab);
  if (!market) {
    throw new NotFoundError("Market");
  }

  return c.json({ market });
});
```

### Pattern 2: Service Calls with Error Handling

```typescript
import { ServiceUnavailableError, InternalServerError } from "@percolator/api/lib/errors";

app.get("/prices", async (c) => {
  try {
    const prices = await fetchPricesFromRpc();
    return c.json({ prices });
  } catch (error) {
    if (error instanceof RpcTimeoutError) {
      throw new ServiceUnavailableError("RPC", "RPC node is not responding");
    }
    if (error instanceof DatabaseError) {
      throw new ServiceUnavailableError("Database");
    }
    throw new InternalServerError("Failed to fetch prices", {
      originalError: error instanceof Error ? error.message : String(error)
    });
  }
});
```

### Pattern 3: Validation with Multiple Fields

```typescript
import { ValidationError } from "@percolator/api/lib/errors";

app.post("/markets", async (c) => {
  const body = await c.req.json();
  const errors: Record<string, string[]> = {};

  if (!body.name) {
    errors.name = ["Market name is required"];
  } else if (body.name.length > 200) {
    errors.name = ["Market name must be 200 characters or less"];
  }

  if (!body.collateralMint) {
    errors.collateralMint = ["Collateral mint is required"];
  } else if (!isValidMint(body.collateralMint)) {
    errors.collateralMint = ["Invalid SPL token mint address"];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError("Market creation validation failed", errors);
  }

  const market = await createMarket(body);
  return c.json({ market });
});
```

## Error Handler Middleware

The `errorHandler()` middleware automatically:

1. **Catches all thrown errors** from route handlers
2. **Converts to standardized format** using the error classes
3. **Logs with context** (method, path, status, request ID)
4. **Assigns request IDs** for tracing
5. **Handles edge cases** like SyntaxError (invalid JSON) and RangeError

### Middleware Stack Order

```typescript
app.use("*", compress());
app.use("*", errorHandler());  // Must be early to catch all errors
app.use("*", sentryMiddleware());
app.use("*", rateLimit());
// ... other middleware
```

## Request ID Tracking

Every error response includes a `requestId` that's also stored in the context:

```typescript
app.get("/test", (c) => {
  const requestId = c.get("requestId"); // Access in route handler
  logger.info("Processing request", { requestId });
  // ...
});
```

This allows correlating logs, monitoring, and error tracking across services.

## Testing Error Responses

```typescript
import { describe, it, expect } from "vitest";
import { BadRequestError } from "@percolator/api/lib/errors";

describe("Market Routes", () => {
  it("should return 400 for invalid slab address", async () => {
    const res = await app.request("/markets/invalid", { method: "GET" });
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("BAD_REQUEST");
    expect(data.error.requestId).toBeDefined();
  });
});
```

## Migration Guide

If you're updating existing routes to use the new error handling:

### Before

```typescript
app.get("/markets/:slab", (c) => {
  const slab = c.req.param("slab");
  if (!slab) {
    return c.json({ error: "Missing slab address" }, 400);
  }

  try {
    const market = await getMarket(slab);
    if (!market) {
      return c.json({ error: "Market not found" }, 404);
    }
    return c.json(market);
  } catch (error) {
    logger.error("Failed to fetch market", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
```

### After

```typescript
import { BadRequestError, NotFoundError, InternalServerError } from "@percolator/api/lib/errors";

app.get("/markets/:slab", (c) => {
  const slab = c.req.param("slab");
  if (!slab) {
    throw new BadRequestError("Slab address is required");
  }

  try {
    const market = await getMarket(slab);
    if (!market) {
      throw new NotFoundError("Market");
    }
    return c.json({ market });
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error; // Re-throw known errors
    }
    throw new InternalServerError("Failed to fetch market");
  }
});
```

The error handler middleware will automatically:
- Format the response correctly
- Assign a request ID
- Log the error with context
- Send the appropriate HTTP status code

## Best Practices

1. **Throw specific errors early** - Don't accumulate logic with generic error handling
2. **Include context in details** - Help downstream debugging with specific information
3. **Don't expose internal errors** - Convert internal errors to generic messages for client responses
4. **Use proper HTTP semantics** - Pick the right error type (400 vs 404 vs 500)
5. **Log sufficient context** - The built-in logging includes method, path, and request ID
6. **Error messages are user-facing** - Write clarity-focused messages, not implementation details
