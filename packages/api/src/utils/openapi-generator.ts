/**
 * OpenAPI Specification Generator
 * Converts endpoint definitions into OpenAPI 3.0.0 specification
 */

import {
  ENDPOINTS,
  API_INFO,
  SERVERS,
  SECURITY_SCHEMES,
  ResponseSchemas,
  EndpointDef,
  errorResponse,
} from "../lib/openapi";
import { z } from "zod";

/**
 * Convert Zod schema to JSON Schema for OpenAPI
 */
function zodToJsonSchema(
  schema: z.ZodSchema,
  definitions: Record<string, any> = {}
): any {
  if (schema instanceof z.ZodString) {
    const s = schema as z.ZodString;
    return {
      type: "string",
      ...(s.description && { description: s.description }),
      ...(s._def.checks?.some((c) => c.kind === "datetime") && {
        format: "date-time",
      }),
      ...(s._def.checks?.some((c) => c.kind === "email") && {
        format: "email",
      }),
    };
  }

  if (schema instanceof z.ZodNumber) {
    const s = schema as z.ZodNumber;
    const checks = (s._def.checks || []) as Array<{ kind: string; value?: any }>;
    return {
      type: s._def.checks?.some((c) => c.kind === "int") ? "integer" : "number",
      ...(s.description && { description: s.description }),
      ...processNumberChecks(checks),
    };
  }

  if (schema instanceof z.ZodBoolean) {
    return {
      type: "boolean",
      ...(schema.description && { description: schema.description }),
    };
  }

  if (schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<any, any>).shape;
    const properties: Record<string, any> = {};
    const requiredFields: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodSchema;
      properties[key] = zodToJsonSchema(fieldSchema, definitions);

      if (!(fieldSchema instanceof z.ZodOptional)) {
        requiredFields.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(requiredFields.length > 0 && { required: requiredFields }),
    };
  }

  if (schema instanceof z.ZodArray) {
    const itemSchema = (schema as z.ZodArray<any>)._def.type;
    return {
      type: "array",
      items: zodToJsonSchema(itemSchema, definitions),
      ...(schema.description && { description: schema.description }),
    };
  }

  if (schema instanceof z.ZodUnion) {
    const options = (schema as z.ZodUnion<any>)._def.options as z.ZodSchema[];
    return {
      oneOf: options.map((opt: z.ZodSchema) => zodToJsonSchema(opt, definitions)),
    };
  }

  if (schema instanceof z.ZodEnum) {
    const values = (schema as z.ZodEnum<any>)._def.values;
    return {
      type: "string",
      enum: values,
      ...(schema.description && { description: schema.description }),
    };
  }

  if (schema instanceof z.ZodNullable) {
    const inner = (schema as z.ZodNullable<any>)._def.innerType;
    const innerSchema = zodToJsonSchema(inner, definitions);
    return {
      oneOf: [innerSchema, { type: "null" }],
      ...(schema.description && { description: schema.description }),
    };
  }

  if ((schema as any)._def?.innerType instanceof z.ZodNumber) {
    const innerType = (schema as any)._def.innerType;
    if (innerType instanceof z.ZodNumber) {
      return {
        type: "number",
        ...(schema.description && { description: schema.description }),
      };
    }
  }

  // Fallback for complex types
  return {
    type: "object",
    ...(schema.description && { description: schema.description }),
  };
}

/**
 * Process number validation checks
 */
function processNumberChecks(
  checks: Array<{ kind: string; value?: any }>
): any {
  const constraints: any = {};

  for (const check of checks) {
    switch (check.kind) {
      case "min":
        constraints.minimum = check.value;
        break;
      case "max":
        constraints.maximum = check.value;
        break;
      case "positive":
        constraints.minimum = 0;
        constraints.exclusiveMinimum = true;
        break;
      case "nonnegative":
        constraints.minimum = 0;
        break;
    }
  }

  return constraints;
}

/**
 * Generate OpenAPI 3.0.0 specification
 */
export function generateOpenAPISpec(): Record<string, any> {
  const paths: Record<string, any> = {};
  const components: Record<string, any> = {
    schemas: {},
    securitySchemes: SECURITY_SCHEMES,
  };

  // Generate paths for each endpoint
  for (const endpoint of ENDPOINTS) {
    const pathKey = endpoint.path;

    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }

    const method = endpoint.method;
    const operation: any = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
    };

    // Add parameters
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      operation.parameters = endpoint.parameters.map((param: any) => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required ?? (param.in === "path"),
        schema: zodToJsonSchema(param.schema),
      }));
    }

    // Add request body
    if (endpoint.requestBody) {
      operation.requestBody = {
        required: endpoint.requestBody.required ?? true,
        content: {
          "application/json": {
            schema: zodToJsonSchema(endpoint.requestBody.schema),
          },
        },
      };
    }

    // Add responses
    operation.responses = {};
    for (const [statusCode, response] of Object.entries(endpoint.responses)) {
      operation.responses[statusCode] = {
        description: (response as any).description,
        content: {
          "application/json": {
            schema: zodToJsonSchema((response as any).schema),
          },
        },
      };
    }

    // Add security if specified
    if (endpoint.security) {
      operation.security = [endpoint.security];
    }

    // Add rate limit headers
    if (endpoint.rateLimit) {
      operation.responses["429"] = {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: zodToJsonSchema(errorResponse),
          },
        },
        headers: {
          "X-RateLimit-Limit": {
            schema: { type: "integer" },
            description: "Request limit per time window",
          },
          "X-RateLimit-Remaining": {
            schema: { type: "integer" },
            description: "Remaining requests in window",
          },
          "X-RateLimit-Reset": {
            schema: { type: "integer" },
            description: "Unix timestamp when limit resets",
          },
        },
      };
    }

    paths[pathKey][method] = operation;
  }

  // Build the complete spec
  const spec = {
    openapi: "3.0.0",
    info: {
      title: API_INFO.title,
      version: API_INFO.version,
      description: API_INFO.description,
      termsOfService: API_INFO.termsOfService,
      contact: API_INFO.contact,
      license: API_INFO.license,
    },
    servers: SERVERS,
    paths,
    components,
    tags: generateTags(),
    "x-readme": {
      explorer: true,
    },
  };

  return spec;
}

/**
 * Generate tags for OpenAPI spec
 */
function generateTags(): Array<{ name: string; description: string }> {
  const tagDescriptions: Record<string, string> = {
    Health:
      "API health status and dependency checks (Supabase, Solana RPC, WebSocket)",
    Markets: "Market discovery, details, and statistics for all traded pairs",
    Trades:
      "Trade history and recent trading activity across markets and users",
    Prices:
      "Current market prices and price subscription via WebSocket in real-time",
    Funding: "Funding rate strategies and historical funding data per market",
    WebSocket:
      "Real-time data subscription endpoints via WebSocket protocol",
    "Real-time": "Real-time data updates and statistics",
  };

  const uniqueTags = new Set<string>();
  ENDPOINTS.forEach((ep: EndpointDef) => ep.tags.forEach((tag: string) => uniqueTags.add(tag)));

  return Array.from(uniqueTags).map((tag) => ({
    name: tag,
    description: tagDescriptions[tag] || `${tag} operations`,
  }));
}

/**
 * Pretty print OpenAPI spec as JSON
 */
export function formatOpenAPISpec(spec: Record<string, any>): string {
  return JSON.stringify(spec, null, 2);
}

/**
 * Validate OpenAPI spec structure
 */
export function validateOpenAPISpec(spec: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (spec.openapi !== "3.0.0") {
    errors.push("Invalid OpenAPI version");
  }

  if (!spec.info?.title) {
    errors.push("Missing API title");
  }

  if (!spec.info?.version) {
    errors.push("Missing API version");
  }

  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    errors.push("No paths defined");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export specification in different formats
 */
export const OpenAPIGenerator = {
  /**
   * Generate full specification
   */
  generate: generateOpenAPISpec,

  /**
   * Generate and format as JSON string
   */
  generateJSON: () => formatOpenAPISpec(generateOpenAPISpec()),

  /**
   * Generate and format as YAML string
   */
  generateYAML: () => {
    const spec = generateOpenAPISpec();
    return yamlStringify(spec);
  },

  /**
   * Validate generated spec
   */
  validate: validateOpenAPISpec,

  /**
   * Get endpoint count
   */
  getEndpointCount: () => ENDPOINTS.length,

  /**
   * Get endpoints by tag
   */
  getEndpointsByTag: (tag: string) =>
    ENDPOINTS.filter((ep: EndpointDef) => ep.tags.includes(tag)),
};

/**
 * Simple YAML stringifier
 */
function yamlStringify(obj: any, indent = 0): string {
  const spaces = "  ".repeat(indent);
  const nextIndent = "  ".repeat(indent + 1);
  let result = "";

  if (typeof obj !== "object" || obj === null) {
    if (typeof obj === "string") {
      return `'${obj.replace(/'/g, "''")}'`;
    }
    return String(obj);
  }

  if (Array.isArray(obj)) {
    return obj
      .map(
        (item, i) =>
          `${i === 0 ? spaces : ""}  - ${yamlStringify(item, indent + 1)}`
      )
      .join("\n");
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        result += `${spaces}${key}:\n${yamlStringify(value, indent + 1)}\n`;
      } else {
        result += `${spaces}${key}:\n${yamlStringify(value, indent + 1)}`;
      }
    } else {
      result += `${spaces}${key}: ${yamlStringify(value, indent)}\n`;
    }
  }

  return result;
}
