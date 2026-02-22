/**
 * Error Handler Tests
 * Verifies standardized error response format across all error types
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  ValidationError,
  isApiError,
  toApiError,
  HttpStatus,
  type ApiErrorResponse,
} from "../src/lib/errors";
import { errorHandler } from "../src/middleware/errorHandler";

describe("Error Classes", () => {
  describe("ApiError base class", () => {
    it("should create an ApiError with all properties", () => {
      const error = new ApiError(
        HttpStatus.BadRequest,
        "TEST_ERROR",
        "Test message",
        { field: "value" }
      );

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Test message");
      expect(error.details).toEqual({ field: "value" });
    });

    it("should generate correct error response", () => {
      const error = new ApiError(
        HttpStatus.BadRequest,
        "TEST_CODE",
        "Test message"
      );
      const response = error.toResponse("req_123");

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe("TEST_CODE");
      expect(response.error.message).toBe("Test message");
      expect(response.error.statusCode).toBe(400);
      expect(response.error.requestId).toBe("req_123");
      expect(response.error.timestamp).toBeDefined();
    });
  });

  describe("BadRequestError", () => {
    it("should create bad request error", () => {
      const error = new BadRequestError("Invalid input", {
        field: "email",
      });

      expect(error.statusCode).toBe(HttpStatus.BadRequest);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Invalid input");
      expect(error.details).toEqual({ field: "email" });
    });
  });

  describe("ValidationError", () => {
    it("should structure validation errors", () => {
      const error = new ValidationError("Validation failed", {
        email: ["Invalid email format"],
        password: ["Too short"],
      });

      expect(error.statusCode).toBe(HttpStatus.BadRequest);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.fields).toEqual({
        email: ["Invalid email format"],
        password: ["Too short"],
      });
    });
  });

  describe("UnauthorizedError", () => {
    it("should create unauthorized error with default message", () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(HttpStatus.Unauthorized);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Missing or invalid authentication");
    });

    it("should create unauthorized error with custom message", () => {
      const error = new UnauthorizedError("API key expired");

      expect(error.message).toBe("API key expired");
    });
  });

  describe("ForbiddenError", () => {
    it("should create forbidden error", () => {
      const error = new ForbiddenError("Insufficient permissions");

      expect(error.statusCode).toBe(HttpStatus.Forbidden);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe("Insufficient permissions");
    });
  });

  describe("NotFoundError", () => {
    it("should create not found error", () => {
      const error = new NotFoundError("Market");

      expect(error.statusCode).toBe(HttpStatus.NotFound);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Market not found");
      expect(error.details).toEqual({ resource: "Market" });
    });
  });

  describe("RateLimitError", () => {
    it("should create rate limit error without retry info", () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(HttpStatus.TooManyRequests);
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.message).toBe("Rate limit exceeded");
    });

    it("should create rate limit error with retry info", () => {
      const error = new RateLimitError(60);

      expect(error.message).toBe("Rate limit exceeded. Retry after 60s");
      expect(error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe("ServiceUnavailableError", () => {
    it("should create service unavailable error", () => {
      const error = new ServiceUnavailableError("Database");

      expect(error.statusCode).toBe(HttpStatus.ServiceUnavailable);
      expect(error.code).toBe("SERVICE_UNAVAILABLE");
      expect(error.message).toBe("Database service unavailable");
      expect(error.details).toEqual({ service: "Database" });
    });

    it("should create error with custom message", () => {
      const error = new ServiceUnavailableError(
        "RPC",
        "RPC node is overloaded"
      );

      expect(error.message).toBe("RPC node is overloaded");
    });
  });

  describe("Type guard isApiError", () => {
    it("should identify ApiError instances", () => {
      const apiError = new BadRequestError("test");
      const regularError = new Error("test");

      expect(isApiError(apiError)).toBe(true);
      expect(isApiError(regularError)).toBe(false);
    });
  });

  describe("toApiError conversion", () => {
    it("should return ApiError as-is", () => {
      const original = new BadRequestError("test");
      const converted = toApiError(original);

      expect(converted).toBe(original);
    });

    it("should convert SyntaxError to BadRequestError", () => {
      const syntaxError = new SyntaxError("Invalid JSON");
      const converted = toApiError(syntaxError);

      expect(converted).toBeInstanceOf(BadRequestError);
      expect(converted.message).toBe("Invalid JSON in request body");
    });

    it("should convert RangeError to BadRequestError", () => {
      const rangeError = new RangeError("Out of bounds");
      const converted = toApiError(rangeError);

      expect(converted).toBeInstanceOf(BadRequestError);
      expect(converted.message).toBe("Value out of range");
    });

    it("should convert generic Error to InternalServerError", () => {
      const error = new Error("Something went wrong");
      const converted = toApiError(error);

      expect(converted).toBeInstanceOf(InternalServerError);
      expect(converted.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("should convert non-Error to InternalServerError", () => {
      const converted = toApiError("string error");

      expect(converted).toBeInstanceOf(InternalServerError);
    });
  });
});

describe("Error Handler Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use("*", errorHandler());
  });

  it("should pass through successful responses", async () => {
    app.get("/success", (c) => c.json({ data: "success" }));

    const res = await app.request("/success");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data).toBe("success");
  });

  it("should catch thrown errors and format response", async () => {
    app.get("/error", () => {
      throw new BadRequestError("Invalid input");
    });

    const res = await app.request("/error");
    expect(res.status).toBe(400);

    const data = (await res.json()) as ApiErrorResponse;
    expect(data.error.code).toBe("BAD_REQUEST");
    expect(data.error.message).toBe("Invalid input");
    expect(data.error.requestId).toBeDefined();
  });

  it("should convert generic errors to InternalServerError", async () => {
    app.get("/crash", () => {
      throw new Error("Database connection lost");
    });

    const res = await app.request("/crash");
    expect(res.status).toBe(500);

    const data = (await res.json()) as ApiErrorResponse;
    expect(data.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("should preserve error details", async () => {
    app.get("/validation", () => {
      throw new ValidationError("Invalid form", {
        email: ["Required"],
        age: ["Must be 18 or older"],
      });
    });

    const res = await app.request("/validation");
    const data = (await res.json()) as ApiErrorResponse;

    expect(data.error.details?.fields).toEqual({
      email: ["Required"],
      age: ["Must be 18 or older"],
    });
  });

  it("should include timestamp in response", async () => {
    app.get("/time", () => {
      throw new NotFoundError("Resource");
    });

    const res = await app.request("/time");
    const data = (await res.json()) as ApiErrorResponse;

    expect(data.error.timestamp).toBeDefined();
    const timestamp = new Date(data.error.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
  });

  it("should generate unique request IDs", async () => {
    const requestIds = new Set<string>();

    app.get("/req", (c) => {
      const id = (c.req.header("x-request-id") || "") as string;
      requestIds.add(id);
      throw new BadRequestError("test");
    });

    for (let i = 0; i < 5; i++) {
      await app.request("/req");
    }

    expect(requestIds.size).toBe(5);
    for (const id of requestIds) {
      expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    }
  });

  it("should handle different HTTP status codes", async () => {
    const testCases = [
      { error: new BadRequestError("bad"), expectedStatus: 400 },
      { error: new UnauthorizedError(), expectedStatus: 401 },
      { error: new ForbiddenError(), expectedStatus: 403 },
      { error: new NotFoundError("Item"), expectedStatus: 404 },
      { error: new RateLimitError(), expectedStatus: 429 },
      {
        error: new InternalServerError("Server issue"),
        expectedStatus: 500,
      },
      { error: new ServiceUnavailableError("DB"), expectedStatus: 503 },
    ];

    for (const { error, expectedStatus } of testCases) {
      const testApp = new Hono();
      testApp.use("*", errorHandler());
      testApp.get("/test", () => {
        throw error;
      });

      const res = await testApp.request("/test");
      expect(res.status).toBe(expectedStatus);
    }
  });
});
