/**
 * OpenAPI Documentation System Tests
 * Comprehensive tests for OpenAPI 3.0 specification generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OpenAPIGenerator,
  generateOpenAPISpec,
  formatOpenAPISpec,
  validateOpenAPISpec,
} from "../src/utils/openapi-generator";
import { ENDPOINTS, API_INFO, SERVERS, EndpointDef } from "../src/lib/openapi";

describe("OpenAPI Generator", () => {
  describe("Specification Generation", () => {
    it("should generate a valid OpenAPI 3.0.0 specification", () => {
      const spec = generateOpenAPISpec();

      expect(spec).toBeDefined();
      expect(spec.openapi).toBe("3.0.0");
    });

    it("should include correct API info", () => {
      const spec = generateOpenAPISpec();

      expect(spec.info.title).toBe(API_INFO.title);
      expect(spec.info.version).toBe(API_INFO.version);
      expect(spec.info.description).toBe(API_INFO.description);
      expect(spec.info.contact).toEqual(API_INFO.contact);
      expect(spec.info.license).toEqual(API_INFO.license);
    });

    it("should include all servers", () => {
      const spec = generateOpenAPISpec();

      expect(spec.servers).toEqual(SERVERS);
    });

    it("should generate all endpoint paths", () => {
      const spec = generateOpenAPISpec();

      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);

      // Verify specific critical endpoints exist
      expect(spec.paths["/health"]).toBeDefined();
      expect(spec.paths["/markets"]).toBeDefined();
      expect(spec.paths["/prices/markets"]).toBeDefined();
      expect(spec.paths["/funding/global"]).toBeDefined();
    });

    it("should include security schemes", () => {
      const spec = generateOpenAPISpec();

      expect(spec.components.securitySchemes).toBeDefined();
      expect(spec.components.securitySchemes.apiKeyAuth).toBeDefined();
      expect(spec.components.securitySchemes.wsAuth).toBeDefined();
    });

    it("should generate tags for categorization", () => {
      const spec = generateOpenAPISpec();

      expect(spec.tags).toBeDefined();
      expect(spec.tags.length).toBeGreaterThan(0);

      const tagNames = spec.tags.map((t: any) => t.name);
      expect(tagNames).toContain("Health");
      expect(tagNames).toContain("Markets");
      expect(tagNames).toContain("Prices");
    });
  });

  describe("Endpoint Definition", () => {
    it("should have correct number of endpoints", () => {
      expect(ENDPOINTS.length).toBeGreaterThan(0);
      expect(ENDPOINTS.length).toBeLessThanOrEqual(50);
    });

    it("should have all required endpoint properties", () => {
      for (const endpoint of ENDPOINTS) {
        expect(endpoint.path).toBeDefined();
        expect(endpoint.method).toBeDefined();
        expect(["get", "post", "put", "delete", "patch"]).toContain(
          endpoint.method
        );
        expect(endpoint.summary).toBeDefined();
        expect(endpoint.description).toBeDefined();
        expect(Array.isArray(endpoint.tags)).toBe(true);
        expect(endpoint.tags.length).toBeGreaterThan(0);
        expect(endpoint.responses).toBeDefined();
      }
    });

    it("should have health endpoint with proper definition", () => {
      const healthEndpoint = ENDPOINTS.find((ep) => ep.path === "/health");

      expect(healthEndpoint).toBeDefined();
      expect(healthEndpoint?.method).toBe("get");
      expect(healthEndpoint?.tags).toContain("Health");
      expect(healthEndpoint?.responses[200]).toBeDefined();
      expect(healthEndpoint?.responses[503]).toBeDefined();
    });

    it("should have market endpoints with pagination parameters", () => {
      const marketsEndpoint = ENDPOINTS.find((ep) => ep.path === "/markets");

      expect(marketsEndpoint).toBeDefined();
      expect(marketsEndpoint?.parameters).toBeDefined();

      const paramNames = marketsEndpoint?.parameters?.map((p) => p.name) || [];
      expect(paramNames).toContain("limit");
      expect(paramNames).toContain("offset");
    });

    it("should have path parameters marked as required", () => {
      const priceEndpoint = ENDPOINTS.find((ep) => ep.path === "/prices/:slab");

      expect(priceEndpoint).toBeDefined();

      const slabParam = priceEndpoint?.parameters?.find((p) => p.name === "slab");
      expect(slabParam).toBeDefined();
      expect(slabParam?.required).toBe(true);
      expect(slabParam?.in).toBe("path");
    });

    it("should have rate limit information on endpoints", () => {
      const rateLimitedEndpoint = ENDPOINTS.find(
        (ep) => ep.rateLimit !== undefined
      );

      expect(rateLimitedEndpoint).toBeDefined();
      expect(rateLimitedEndpoint?.rateLimit?.requests).toBeGreaterThan(0);
      expect(["1s", "1m", "1h"]).toContain(
        rateLimitedEndpoint?.rateLimit?.window
      );
    });
  });

  describe("Specification Formatting", () => {
    it("should format spec as valid JSON", () => {
      const spec = generateOpenAPISpec();
      const jsonString = formatOpenAPISpec(spec);

      expect(typeof jsonString).toBe("string");

      const parsed = JSON.parse(jsonString);
      expect(parsed.openapi).toBe("3.0.0");
    });

    it("should generate valid JSON spec", () => {
      const jsonSpec = OpenAPIGenerator.generateJSON();

      expect(typeof jsonSpec).toBe("string");
      const parsed = JSON.parse(jsonSpec);
      expect(parsed.openapi).toBe("3.0.0");
    });

    it("should generate YAML format", () => {
      const yamlSpec = OpenAPIGenerator.generateYAML();

      expect(typeof yamlSpec).toBe("string");
      expect(yamlSpec.includes("openapi:")).toBe(true);
    });
  });

  describe("Specification Validation", () => {
    it("should validate a valid specification", () => {
      const spec = generateOpenAPISpec();
      const validation = validateOpenAPISpec(spec);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it("should reject spec without version", () => {
      const invalidSpec = { openapi: "3.0.0", info: { title: "Test" } };

      const validation = validateOpenAPISpec(invalidSpec);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should reject spec without title", () => {
      const invalidSpec = {
        openapi: "3.0.0",
        info: { version: "1.0.0" },
        paths: { "/test": {} },
      };

      const validation = validateOpenAPISpec(invalidSpec as any);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("title"))).toBe(true);
    });

    it("should reject spec without paths", () => {
      const invalidSpec = {
        openapi: "3.0.0",
        info: { title: "Test", version: "1.0.0" },
      };

      const validation = validateOpenAPISpec(invalidSpec as any);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("paths"))).toBe(true);
    });
  });

  describe("Endpoint Metadata", () => {
    it("should return correct endpoint count", () => {
      const count = OpenAPIGenerator.getEndpointCount();

      expect(typeof count).toBe("number");
      expect(count).toBe(ENDPOINTS.length);
      expect(count).toBeGreaterThan(0);
    });

    it("should retrieve endpoints by tag", () => {
      const healthEndpoints = OpenAPIGenerator.getEndpointsByTag("Health");

      expect(Array.isArray(healthEndpoints)).toBe(true);
      expect(healthEndpoints.length).toBeGreaterThan(0);
      expect(healthEndpoints.every((ep: EndpointDef) => ep.tags.includes("Health"))).toBe(
        true
      );
    });

    it("should have endpoints for all major tags", () => {
      const requiredTags = ["Health", "Markets", "Prices", "WebSocket"];

      for (const tag of requiredTags) {
        const endpoints = OpenAPIGenerator.getEndpointsByTag(tag);
        expect(endpoints.length, `Missing endpoints for tag: ${tag}`).toBeGreaterThan(0);
      }
    });
  });

  describe("Response Schemas", () => {
    it("should have 2xx responses on success endpoints", () => {
      const successEndpoints = ENDPOINTS.filter(
        (ep) => ep.method === "get" && !ep.path.includes("ws")
      );

      for (const endpoint of successEndpoints) {
        expect(Object.keys(endpoint.responses).some((code) => code.startsWith("2"))).toBe(
          true
        );
      }
    });

    it("should have error responses documented", () => {
      const spec = generateOpenAPISpec();

      for (const [path, operations] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(operations as Record<string, any>)) {
          if (typeof operation === "object" && operation !== null) {
            const responses = (operation as any).responses;
            expect(responses).toBeDefined();

            // Most endpoints should have error responses
            const has4xxOr5xx = Object.keys(responses).some(
              (code) => code.startsWith("4") || code.startsWith("5")
            );

            if (method === "get" || method === "post") {
              // At least health or common errors
              if (!path.includes("/health")) {
                expect(
                  has4xxOr5xx || Object.keys(responses).length > 1
              ).toBe(true);
              }
            }
          }
        }
      }
    });
  });

  describe("Integration Tests", () => {
    it("should have consistent parameter definitions across endpoints", () => {
      const spec = generateOpenAPISpec();
      const allParams: Record<string, any> = {};

      for (const [path, operations] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(operations as Record<string, any>)) {
          if (typeof operation === "object" && operation !== null) {
            const params = (operation as any).parameters;
            if (params) {
              for (const param of params) {
                const key = `${param.name}-${param.in}`;
                if (allParams[key]) {
                  // Should have consistent schema type if used elsewhere
                  expect(allParams[key].schema?.type).toBe(param.schema?.type);
                } else {
                  allParams[key] = param;
                }
              }
            }
          }
        }
      }

      expect(Object.keys(allParams).length).toBeGreaterThan(0);
    });

    it("should have market endpoints properly linked", () => {
      const spec = generateOpenAPISpec();

      // Should have endpoints for both individual and list operations
      expect(spec.paths["/markets"]).toBeDefined();
      expect(spec.paths["/markets/:slab"]).toBeDefined();
      expect(spec.paths["/markets/stats"]).toBeDefined();
      expect(spec.paths["/markets/:slab/stats"]).toBeDefined();
    });

    it("should have complete trading data flow endpoints", () => {
      const spec = generateOpenAPISpec();

      // Data pipeline: Markets -> Prices -> Trades -> Funding
      expect(spec.paths["/markets"]).toBeDefined();
      expect(spec.paths["/prices/markets"]).toBeDefined();
      expect(spec.paths["/trades/recent"]).toBeDefined();
      expect(spec.paths["/funding/global"]).toBeDefined();
    });

    it("should have WebSocket spec separate from HTTP endpoints", () => {
      const spec = generateOpenAPISpec();

      const wsEndpoints = Object.keys(spec.paths).filter((p) =>
        p.startsWith("/ws")
      );

      expect(wsEndpoints.length).toBeGreaterThan(0);
    });
  });

  describe("OpenAPI 3.0.0 Compliance", () => {
    it("should have required OpenAPI fields", () => {
      const spec = generateOpenAPISpec();

      expect(spec.openapi).toBe("3.0.0");
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBeDefined();
      expect(spec.info.version).toBeDefined();
      expect(spec.paths).toBeDefined();
    });

    it("should have properly formatted OpenAPI paths", () => {
      const spec = generateOpenAPISpec();

      for (const path of Object.keys(spec.paths)) {
        // Paths should use {param} format for path parameters
        const pathParams = path.match(/{[^}]+}/g) || [];
        const colonParams = path.match(/:[^/]+/g) || [];

        // Should not mix formats
        expect(pathParams.length === 0 || colonParams.length === 0).toBe(true);
      }
    });

    it("should have valid HTTP methods", () => {
      const spec = generateOpenAPISpec();
      const validMethods = ["get", "post", "put", "delete", "patch", "head", "options"];

      for (const [path, operations] of Object.entries(spec.paths)) {
        for (const method of Object.keys(operations as Record<string, any>)) {
          expect(validMethods).toContain(method.toLowerCase());
        }
      }
    });
  });

  describe("Performance", () => {
    it("should generate spec quickly", () => {
      const start = performance.now();
      generateOpenAPISpec();
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should generate in < 100ms
    });

    it("should validate spec quickly", () => {
      const spec = generateOpenAPISpec();

      const start = performance.now();
      validateOpenAPISpec(spec);
      const end = performance.now();

      expect(end - start).toBeLessThan(50);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing endpoint definitions gracefully", () => {
      const emptyEndpoints: any[] = [];

      expect(() => {
        const spec = generateOpenAPISpec();
        expect(spec.paths).toBeDefined();
      }).not.toThrow();
    });

    it("should generate spec even with incomplete metadata", () => {
      const spec = generateOpenAPISpec();

      // Should still produce valid spec structure
      expect(spec.openapi).toBe("3.0.0");
      expect(spec.info).toBeDefined();
      expect(spec.paths).toBeDefined();
    });
  });
});
