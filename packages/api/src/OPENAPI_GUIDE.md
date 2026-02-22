/**
 * API Documentation Implementation Guide
 * OpenAPI 3.0 Specification & Swagger UI Integration
 */

# Comprehensive API Documentation System - Implementation Guide

## Overview

This guide explains the OpenAPI 3.0 specification system integrated into the Percolator Launch API. The system provides:

- **Interactive Swagger UI** at `/docs` for testing endpoints
- **OpenAPI Specification** in JSON/YAML formats at `/docs/openapi.json` and `/docs/openapi.yaml`
- **Endpoint Discovery** via `/docs/endpoints` for programmatic access
- **Type-Safe Schemas** using Zod for runtime validation
- **Automatic Documentation** from endpoint metadata

## Architecture

### Components

#### 1. `packages/api/src/lib/openapi.ts`
**Defines all API endpoints and schemas**

```typescript
// Zod schemas for type safety
export const Schemas = {
  slabAddress: z.string().describe("..."),
  mint: z.string().describe("..."),
  // ... more schemas
};

// Response schema definitions
export const ResponseSchemas = {
  market: z.object({ ... }),
  trade: z.object({ ... }),
  health: z.object({ ... }),
  // ... more schemas
};

// All endpoint definitions
export const ENDPOINTS: EndpointDef[] = [
  {
    path: "/markets",
    method: "get",
    summary: "List All Markets",
    description: "...",
    tags: ["Markets"],
    parameters: [...],
    responses: {
      200: { description: "...", schema: ... },
      503: { description: "...", schema: ... }
    }
  },
  // ... 22+ more endpoints
];

// API metadata
export const API_INFO = { ... };
export const SERVERS = [ ... ];
export const SECURITY_SCHEMES = { ... };
```

#### 2. `packages/api/src/utils/openapi-generator.ts`
**Converts endpoint definitions to OpenAPI 3.0 spec**

```typescript
// Main generator function
export function generateOpenAPISpec(): Record<string, any> {
  // Converts ENDPOINTS using zodToJsonSchema()
  // Builds complete OpenAPI 3.0 compatible spec
}

// Export utilities
export const OpenAPIGenerator = {
  generate: () => {...},        // Get spec object
  generateJSON: () => {...},    // Get JSON string
  generateYAML: () => {...},    // Get YAML string
  validate: (spec) => {...},    // Validate spec compliance
  getEndpointCount: () => {...}, // Count endpoints
  getEndpointsByTag: (tag) => {...} // Filter by tag
};
```

#### 3. `packages/api/src/routes/docs.ts`
**Serves documentation endpoints**

```typescript
export function docsRoutes(): Hono {
  app.get("/docs", ...)              // Swagger UI HTML
  app.get("/docs/openapi.json", ...); // OpenAPI spec JSON
  app.get("/docs/openapi.yaml", ...); // OpenAPI spec YAML
  app.get("/docs/health", ...);       // Documentation health check
  app.get("/docs/endpoints", ...);    // Endpoint list & metadata
}
```

## Using the Documentation System

### 1. Accessing Documentation

**Interactive Swagger UI:**
```
GET http://localhost:3001/docs
```
Opens an interactive interface where you can:
- Browse all endpoints organized by tag
- View detailed endpoint information
- Test endpoints with the "Try it out" feature
- View request/response examples

**OpenAPI Specification:**
```
# JSON format
GET http://localhost:3001/docs/openapi.json

# YAML format
GET http://localhost:3001/docs/openapi.yaml
```

**Endpoint Directory:**
```
GET http://localhost:3001/docs/endpoints

Response:
{
  "endpoints": [
    {
      "path": "/markets",
      "method": "GET",
      "summary": "List All Markets",
      "tags": ["Markets"],
      ...
    }
  ],
  "total": 22,
  "byTag": {
    "Markets": [...],
    "Prices": [...],
    "WebSocket": [...]
  }
}
```

### 2. Adding New Endpoints

Add new endpoints to `packages/api/src/lib/openapi.ts`:

```typescript
// Step 1: Define any new schemas needed
export const ResponseSchemas = {
  // existing schemas...
  myNewResponse: z.object({
    data: z.string().describe("New field"),
    count: z.number().describe("Count of items"),
  }),
};

// Step 2: Add endpoint definition to ENDPOINTS array
{
  path: "/my-new-endpoint/:id",
  method: "get",
  summary: "Get My New Endpoint",
  description: "Detailed description of what this endpoint does",
  tags: ["MyTag"],
  parameters: [
    {
      name: "id",
      schema: z.string().describe("Item ID"),
      description: "The ID of the item to retrieve",
      required: true,
      in: "path",
    },
    {
      name: "limit",
      schema: Schemas.limit,
      description: "Results per page",
      in: "query",
    },
  ],
  responses: {
    200: {
      description: "Successfully retrieved data",
      schema: ResponseSchemas.myNewResponse,
    },
    404: {
      description: "Item not found",
      schema: errorResponse,
    },
  },
  rateLimit: { requests: 100, window: "1m" },
}

// Step 3: Implementation already generates the documentation!
// No additional configuration needed
```

### 3. Updating Existing Endpoints

Simply modify the endpoint definition in `ENDPOINTS`:

```typescript
{
  path: "/markets",
  method: "get",
  summary: "List All Markets",
  description: "Updated description...", // ← Update here
  tags: ["Markets"],
  parameters: [
    // Add new parameters or modify existing
    {
      name: "symbol",
      schema: z.string().optional(),
      description: "Filter by token symbol",
      in: "query",
    },
  ],
  // ... responses, etc.
}
```

Changes are immediately reflected in documentation!

### 4. Reusing Schemas

Leverage predefined schemas to maintain consistency:

```typescript
// ✅ Good - Reusing schemas
{
  parameters: [
    {
      name: "limit",
      schema: Schemas.limit,  // Reuse predefined
      in: "query",
    },
    {
      name: "offset",
      schema: Schemas.offset, // Reuse predefined
      in: "query",
    },
  ],
}

// ❌ Avoid - Duplicating schema definitions
{
  parameters: [
    {
      name: "limit",
      schema: z.coerce.number().int().positive().max(500),
      in: "query",
    },
  ],
}
```

## Integration with Routes

### Update Route Registration

In your main API setup (typically `packages/api/src/index.ts`):

```typescript
import { docsRoutes } from "./routes/docs";

const app = new Hono();

// Register documentation routes
app.route("/", docsRoutes());

// Register other routes
app.route("/api", apiRoutes());

export default app;
```

## Testing Documentation

### Running Tests

```bash
pnpm test --run packages/api/tests/openapi.test.ts
```

### Manual Testing

```bash
# Start dev server
pnpm dev

# Test documentation endpoints
curl http://localhost:3001/docs/health

curl http://localhost:3001/docs/openapi.json | jq .

curl http://localhost:3001/docs/endpoints | jq .
```

## Common Patterns

### Pattern 1: Pagination

```typescript
parameters: [
  {
    name: "limit",
    schema: Schemas.limit,
    description: "Results per page",
    in: "query",
  },
  {
    name: "offset",
    schema: Schemas.offset,
    description: "Pagination offset",
    in: "query",
  },
]
```

### Pattern 2: Cached Endpoints

```typescript
{
  path: "/markets/stats",
  method: "get",
  summary: "Get Market Statistics",
  description: "Uses cached data updated every 60 seconds.",
  tags: ["Markets"],
  responses: {
    200: {
      description: "Statistics retrieved (may be cached)",
      schema: z.object({ stats: z.array(ResponseSchemas.marketStats) }),
    },
  },
}
```

### Pattern 3: Path Parameters

```typescript
parameters: [
  {
    name: "slab",
    schema: Schemas.slabAddress,
    description: "Market slab address",
    required: true,  // ← Must be true for path params
    in: "path",      // ← Must be "path"
  },
]
```

### Pattern 4: Error Responses

```typescript
responses: {
  200: {
    description: "Success",
    schema: ResponseSchemas.market,
  },
  400: {
    description: "Invalid parameters",
    schema: errorResponse,
  },
  503: {
    description: "Database unavailable",
    schema: errorResponse,
  },
}
```

### Pattern 5: WebSocket Endpoints

```typescript
{
  path: "/ws",
  method: "get",
  summary: "WebSocket Price Stream",
  description: "Subscribe to real-time price updates via WebSocket",
  tags: ["WebSocket", "Real-time"],
  responses: {
    101: {
      description: "WebSocket connection established",
      schema: z.object({ type: z.literal("subscribe") }),
    },
    401: {
      description: "Authentication failed",
      schema: errorResponse,
    },
  },
}
```

## Generator Features

### Type Safety

All schemas use Zod for runtime validation:

```typescript
const slabAddress = Schemas.slabAddress; // z.string().describe(...)

// Validates at runtime
const validated = slabAddress.parse("11111111111111111111111111111111");

// Type inference
type SlabAddress = z.infer<typeof slabAddress>;
```

### Format Conversion

```typescript
// Generate as object
const spec = OpenAPIGenerator.generate();

// Generate as JSON string (for APIs)
const json = OpenAPIGenerator.generateJSON();

// Generate as YAML string (for files)
const yaml = OpenAPIGenerator.generateYAML();
```

### Validation

```typescript
const spec = OpenAPIGenerator.generate();
const validation = OpenAPIGenerator.validate(spec);

if (validation.valid) {
  console.log("✅ Spec is valid OpenAPI 3.0.0");
} else {
  console.log("❌ Errors:", validation.errors);
}
```

### Metadata Access

```typescript
// Get all endpoints
const allEndpoints = OpenAPIGenerator.getEndpointCount(); // 22

// Filter by tag
const marketEndpoints = OpenAPIGenerator.getEndpointsByTag("Markets");
// Returns: [
//   { path: "/markets", method: "get", ... },
//   { path: "/markets/:slab", method: "get", ... },
//   ...
// ]
```

## Client Generation

The OpenAPI spec can be used to generate client SDKs:

### Using OpenAPI Generator

```bash
# Generate TypeScript client
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3001/docs/openapi.json \
  -g typescript-fetch \
  -o ./client-sdk

# Generate Python client
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3001/docs/openapi.json \
  -g python \
  -o ./client-sdk-python
```

### Using OpenAPI TypeScript

```bash
# Create TypeScript types from spec
npx openapi-typescript http://localhost:3001/docs/openapi.json -o types.ts
```

## Maintenance

### Regular Updates

1. **When adding endpoints:**
   - Add to `ENDPOINTS` array in `openapi.ts`
   - Run tests: `pnpm test openapi.test.ts`
   - Verify in Swagger UI: `http://localhost:3001/docs`

2. **When modifying responses:**
   - Update response schema in `ResponseSchemas`
   - Update endpoint response definition
   - Tests verify schema consistency

3. **When changing parameters:**
   - Update `parameters` array
   - Verify in `/docs/endpoints`
   - Test with Swagger UI

### Quality Checks

```bash
# Validate specification
curl http://localhost:3001/docs/health | jq .

# Check endpoint count
curl http://localhost:3001/docs/endpoints | jq '.total'

# Validate JSON schema
curl http://localhost:3001/docs/openapi.json | jq 'keys'
```

## Documentation Best Practices

### 1. Clear Descriptions

```typescript
// ✅ Good
{
  path: "/prices/:slab",
  summary: "Get Market Price",
  description: "Get the current price for a specific market. Returns latest mark price with timestamp.",
}

// ❌ Poor
{
  path: "/prices/:slab",
  summary: "Get price",
  description: "Returns price",
}
```

### 2. Semantic Schema Naming

```typescript
// ✅ Good - Semantic names
ResponseSchemas = {
  market: z.object({ ... }),
  trade: z.object({ ... }),
  funding: z.object({ ... }),
};

// ❌ Poor - Generic names
ResponseSchemas = {
  data1: z.object({ ... }),
  response2: z.object({ ... }),
};
```

### 3. Detailed Parameter Descriptions

```typescript
// ✅ Good
{
  name: "hours",
  schema: Schemas.hours,
  description: "Look-back period in hours (default 24, max 720 = 30 days)",
  in: "query",
}

// ❌ Poor
{
  name: "hours",
  schema: z.number(),
  description: "Hours",
  in: "query",
}
```

### 4. Example Values

```typescript
// ✅ Good
slabAddress: z
  .string()
  .describe("Solana public key (base58)")
  .example("11111111111111111111111111111111"),

// Via `.example()` or `.describe()`
```

## Troubleshooting

### Issue: "Paths not rendering in Swagger UI"

**Cause:** Path parameter format mismatch
**Solution:** Ensure paths use `:param` format (not `{param}`):
```typescript
path: "/markets/:slab",  // ✅ Correct
path: "/markets/{slab}", // ❌ Wrong for our setup
```

### Issue: "Schema validation failing"

**Cause:** Zod schema error
**Solution:** Check schema definition:
```typescript
// ✅ Correct
schema: z.string().describe("...")

// ❌ Wrong - Missing schema definition
schema: undefined
```

### Issue: "Missing security scheme"

**Cause:** Security not defined in endpoint
**Solution:** Add security if needed:
```typescript
security: {
  apiKeyAuth: ["x-api-key"],
}
```

### Issue: "Response schema incomplete"

**Cause:** Missing response definitions
**Solution:** Ensure all HTTP status codes are documented:
```typescript
responses: {
  200: { description: "Success", schema: ... },
  400: { description: "Bad request", schema: ... },
  500: { description: "Server error", schema: ... },
}
```

## Performance Implications

- **Generation Speed:** < 100ms for all 22 endpoints
- **Memory**: Spec object ~150KB
- **Cache Duration:** 3600s (1 hour) for JSON/YAML responses
- **No Runtime Overhead:** Spec generated once on startup, cached

## Security Considerations

- Specification is public (no sensitive data in paths/parameters)
- Response examples use representative (not real) data
- Error codes don't leak implementation details
- Rate limit information helps clients stay compliant
- WebSocket auth schemes documented separately

## Integration Checklist

- [ ] Endpoint definitions added to `openapi.ts`
- [ ] Response schemas defined with Zod
- [ ] All parameters documented
- [ ] Error responses included (400, 401, 403, 404, 429, 500, 503)
- [ ] Rate limit information specified
- [ ] Tags assigned correctly
- [ ] Tests run successfully
- [ ] Swagger UI displays correctly
- [ ] OpenAPI validation passes
- [ ] Client SDK generation tested (optional)

## File Structure

```
packages/api/
├── src/
│   ├── lib/
│   │   └── openapi.ts                 # Schema & endpoint definitions
│   ├── utils/
│   │   └── openapi-generator.ts       # Spec generator
│   ├── routes/
│   │   └── docs.ts                    # Documentation endpoints
│   └── index.ts                       # Route integration
├── tests/
│   └── openapi.test.ts                # Comprehensive test suite
└── README.md                          # (This file)
```

## Related Documentation

- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [Zod Documentation](https://zod.dev/)
- [Hono Middleware](https://hono.dev/)

## Support & Contribution

For issues or improvements:
1. Check troubleshooting section above
2. Review test cases in `openapi.test.ts`
3. Verify endpoint definitions against Percolator protocol
4. Submit PR with updated endpoints and tests

---

**Last Updated:** February 22, 2026
**Version:** 1.0.0
**Compatibility:** OpenAPI 3.0.0, Swagger UI 4.x
