/**
 * OpenAPI Documentation Types & Schemas
 * Defines all API endpoints, parameters, and response schemas
 */

import { z } from "zod";

/**
 * Base schema types used across the API
 */
export const Schemas = {
  // Core domain types
  slabAddress: z
    .string()
    .describe("Solana public key in base58 format (32-44 characters)"),

  mint: z
    .string()
    .describe("SPL token mint address (base58)"),

  publicKey: z
    .string()
    .describe("Solana public key (base58)"),

  signature: z
    .string()
    .describe("Transaction signature (base58)"),

  bigint: z
    .string()
    .describe("Large integer as string to preserve precision"),

  priceE6: z
    .string()
    .describe("Price with 6 decimal places (e.g., 1.50 = 1500000)"),

  timestamp: z
    .string()
    .datetime()
    .describe("ISO 8601 timestamp"),

  limit: z
    .coerce
    .number()
    .int()
    .positive()
    .max(500)
    .default(50)
    .describe("Number of results per page (1-500, default 50)"),

  offset: z
    .coerce
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Pagination offset (default 0)"),

  hours: z
    .coerce
    .number()
    .int()
    .positive()
    .max(720)
    .default(24)
    .describe("Look-back window in hours (default 24, max 720)"),
};

/**
 * Response schemas for all endpoints
 */
export const ResponseSchemas = {
  // Market types
  market: z.object({
    slabAddress: Schemas.slabAddress,
    mintAddress: Schemas.mint,
    symbol: z.string().describe("Token symbol (e.g., 'BONK', 'SOL')"),
    name: z.string().describe("Token name"),
    decimals: z
      .number()
      .int()
      .min(0)
      .max(12)
      .describe("Token decimal places"),
    deployer: Schemas.publicKey,
    initialPriceE6: Schemas.priceE6,
    maxLeverage: z.number().positive().describe("Maximum leverage allowed (2x-20x)"),
    tradingFeeBps: z.number().describe("Trading fee in basis points (0-100)"),
    status: z
      .enum(["active", "paused", "resolved", "liquidated"])
      .describe("Market status"),
    createdAt: Schemas.timestamp,
    updatedAt: Schemas.timestamp,
  }),

  marketStats: z.object({
    _type: z.literal("MarketStats"),
    slabAddress: Schemas.slabAddress,
    totalOpenInterest: Schemas.bigint.nullable(),
    totalAccounts: z.number().nullable().describe("Number of open positions"),
    totalVolume24h: Schemas.bigint.nullable().describe("24h volume"),
    totalFees24h: Schemas.bigint.nullable().describe("24h fees collected"),
    lastCrankSlot: Schemas.bigint.nullable().describe("Solana slot of last crank"),
    lastPrice: Schemas.priceE6.nullable(),
    fundingRate: z
      .string()
      .nullable()
      .describe("Current funding rate (8 decimals)"),
    fundingRateApr: z.string().nullable().describe("Annualized funding rate"),
  }),

  trade: z.object({
    signature: Schemas.signature,
    slabAddress: Schemas.slabAddress,
    trader: Schemas.publicKey,
    side: z.enum(["long", "short"]).describe("Trade direction"),
    size: Schemas.bigint.describe("Position size"),
    price: Schemas.priceE6.describe("Execution price"),
    fee: Schemas.bigint.describe("Trading fee paid"),
    timestamp: Schemas.timestamp,
  }),

  price: z.object({
    slabAddress: Schemas.slabAddress,
    priceE6: Schemas.priceE6.describe("Current price"),
    timestamp: Schemas.timestamp,
    source: z.enum(["oracle", "mark", "index"]).describe("Price source"),
  }),

  funding: z.object({
    slabAddress: Schemas.slabAddress,
    fundingRate: z.string().describe("Funding rate (8 decimals)"),
    fundingRateApr: z.string().describe("Annualized APR"),
    timestamp: Schemas.timestamp,
  }),

  health: z.object({
    status: z
      .enum(["ok", "degraded", "down"])
      .describe("Overall API health status"),
    checks: z.object({
      db: z.boolean().describe("Supabase connectivity"),
      rpc: z.boolean().describe("Solana RPC connectivity"),
    }),
    uptime: z.number().describe("API uptime in seconds"),
    timestamp: Schemas.timestamp,
  }),
};

/**
 * Error response schema
 */
export const errorResponse = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().describe("Error code (e.g., BAD_REQUEST, NOT_FOUND)"),
    statusCode: z.number(),
    requestId: z.string().optional(),
    timestamp: Schemas.timestamp,
    details: z.record(z.unknown()).optional(),
  }),
});

/**
 * Endpoint definitions for OpenAPI generation
 */
export interface EndpointDef {
  path: string;
  method: "get" | "post" | "put" | "delete" | "patch";
  summary: string;
  description: string;
  tags: string[];
  parameters?: {
    name: string;
    schema: z.ZodSchema;
    description: string;
    required?: boolean;
    in: "path" | "query" | "header" | "cookie";
  }[];
  requestBody?: {
    schema: z.ZodSchema;
    required?: boolean;
  };
  responses: {
    [statusCode: number]: {
      description: string;
      schema: z.ZodSchema;
    };
  };
  security?: {
    bearerAuth?: string[];
    apiKeyAuth?: string[];
  };
  rateLimit?: {
    requests: number;
    window: "1s" | "1m" | "1h";
  };
}

/**
 * All API endpoints
 */
export const ENDPOINTS: EndpointDef[] = [
  // Health & Status
  {
    path: "/health",
    method: "get",
    summary: "Health Check",
    description:
      "Check API health status and dependency connectivity (Supabase, Solana RPC)",
    tags: ["Health"],
    responses: {
      200: {
        description: "API is healthy",
        schema: ResponseSchemas.health,
      },
      503: {
        description: "API is down or dependencies unavailable",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 60, window: "1m" },
  },

  // Markets
  {
    path: "/markets",
    method: "get",
    summary: "List All Markets",
    description:
      "Get all available perpetual futures markets with statistics. Results are cached for 30 seconds.",
    tags: ["Markets"],
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
    ],
    responses: {
      200: {
        description: "Successfully retrieved markets",
        schema: z.object({
          markets: z.array(ResponseSchemas.market),
          total: z.number(),
          timestamp: Schemas.timestamp,
        }),
      },
      503: {
        description: "Database unavailable, using cached data",
        schema: z.object({
          markets: z.array(ResponseSchemas.market),
          cached: z.boolean(),
        }),
      },
    },
    rateLimit: { requests: 100, window: "1m" },
  },

  {
    path: "/markets/:slab",
    method: "get",
    summary: "Get Market Details",
    description:
      "Get detailed market information including on-chain state, configuration, and engine metrics. Results cached for 10 seconds.",
    tags: ["Markets"],
    parameters: [
      {
        name: "slab",
        schema: Schemas.slabAddress,
        description: "Market slab address",
        required: true,
        in: "path",
      },
    ],
    responses: {
      200: {
        description: "Market details retrieved successfully",
        schema: z.object({
          slabAddress: Schemas.slabAddress,
          header: z.object({
            magic: z.string(),
            version: z.number(),
            admin: Schemas.publicKey,
            resolved: z.boolean(),
          }),
          config: z.object({
            collateralMint: Schemas.mint,
            vault: Schemas.publicKey,
            oracleAuthority: Schemas.publicKey,
          }),
          engine: z.object({
            vault: Schemas.bigint,
            totalOpenInterest: Schemas.bigint,
            numUsedAccounts: z.number(),
            lastCrankSlot: Schemas.bigint,
          }),
        }),
      },
      400: {
        description: "Invalid slab address or market not found",
        schema: errorResponse,
      },
      503: {
        description: "RPC unavailable",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 100, window: "1m" },
  },

  {
    path: "/markets/stats",
    method: "get",
    summary: "Get All Market Statistics",
    description:
      "Get aggregated statistics for all markets. Uses cached data updated every 60 seconds.",
    tags: ["Markets"],
    responses: {
      200: {
        description: "Market statistics retrieved",
        schema: z.object({
          stats: z.array(ResponseSchemas.marketStats),
          timestamp: Schemas.timestamp,
        }),
      },
      503: {
        description: "Database unavailable",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 60, window: "1m" },
  },

  {
    path: "/markets/:slab/stats",
    method: "get",
    summary: "Get Market Statistics",
    description: "Get statistics for a specific market.",
    tags: ["Markets"],
    parameters: [
      {
        name: "slab",
        schema: Schemas.slabAddress,
        description: "Market slab address",
        required: true,
        in: "path",
      },
    ],
    responses: {
      200: {
        description: "Market statistics retrieved",
        schema: z.object({
          stats: ResponseSchemas.marketStats.nullable(),
          timestamp: Schemas.timestamp,
        }),
      },
      400: {
        description: "Invalid slab address",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 100, window: "1m" },
  },

  // Trades
  {
    path: "/markets/:slab/trades",
    method: "get",
    summary: "Get Market Trades",
    description:
      "Get recent trades for a specific market, ordered by timestamp descending.",
    tags: ["Trades"],
    parameters: [
      {
        name: "slab",
        schema: Schemas.slabAddress,
        description: "Market slab address",
        required: true,
        in: "path",
      },
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
    ],
    responses: {
      200: {
        description: "Trades retrieved successfully",
        schema: z.object({
          trades: z.array(ResponseSchemas.trade),
          total: z.number(),
          timestamp: Schemas.timestamp,
        }),
      },
      400: {
        description: "Invalid parameters",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 100, window: "1m" },
  },

  {
    path: "/trades/recent",
    method: "get",
    summary: "Get Recent Trades Across Markets",
    description: "Get the most recent trades across all markets.",
    tags: ["Trades"],
    parameters: [
      {
        name: "limit",
        schema: Schemas.limit,
        description: "Number of trades to return",
        in: "query",
      },
    ],
    responses: {
      200: {
        description: "Recent trades retrieved",
        schema: z.object({
          trades: z.array(ResponseSchemas.trade),
          timestamp: Schemas.timestamp,
        }),
      },
    },
    rateLimit: { requests: 60, window: "1m" },
  },

  // Prices
  {
    path: "/prices/markets",
    method: "get",
    summary: "Get All Market Prices",
    description: "Get current prices for all markets. Updated via Helius Geyser.",
    tags: ["Prices"],
    responses: {
      200: {
        description: "Prices retrieved successfully",
        schema: z.object({
          prices: z.array(ResponseSchemas.price),
          timestamp: Schemas.timestamp,
        }),
      },
    },
    rateLimit: { requests: 100, window: "1m" },
  },

  {
    path: "/prices/:slab",
    method: "get",
    summary: "Get Market Price",
    description:
      "Get the current price for a specific market. Returns latest mark price.",
    tags: ["Prices"],
    parameters: [
      {
        name: "slab",
        schema: Schemas.slabAddress,
        description: "Market slab address",
        required: true,
        in: "path",
      },
    ],
    responses: {
      200: {
        description: "Price retrieved",
        schema: ResponseSchemas.price,
      },
      404: {
        description: "Market not found",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 200, window: "1m" },
  },

  // Funding
  {
    path: "/funding/global",
    method: "get",
    summary: "Get Global Funding Rates",
    description: "Get current funding rates for all markets. Cached for 60 seconds.",
    tags: ["Funding"],
    responses: {
      200: {
        description: "Funding rates retrieved",
        schema: z.object({
          rates: z.array(ResponseSchemas.funding),
          timestamp: Schemas.timestamp,
        }),
      },
    },
    rateLimit: { requests: 60, window: "1m" },
  },

  {
    path: "/funding/:slab",
    method: "get",
    summary: "Get Market Funding Rate",
    description: "Get current funding rate for a specific market.",
    tags: ["Funding"],
    parameters: [
      {
        name: "slab",
        schema: Schemas.slabAddress,
        description: "Market slab address",
        required: true,
        in: "path",
      },
    ],
    responses: {
      200: {
        description: "Funding rate retrieved",
        schema: ResponseSchemas.funding,
      },
      404: {
        description: "Market not found",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 100, window: "1m" },
  },

  {
    path: "/funding/:slab/history",
    method: "get",
    summary: "Get Funding Rate History",
    description: "Get historical funding rates for a market.",
    tags: ["Funding"],
    parameters: [
      {
        name: "slab",
        schema: Schemas.slabAddress,
        description: "Market slab address",
        required: true,
        in: "path",
      },
      {
        name: "hours",
        schema: Schemas.hours,
        description: "Look-back period",
        in: "query",
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
        description: "Funding rate history retrieved",
        schema: z.object({
          history: z.array(ResponseSchemas.funding),
          total: z.number(),
        }),
      },
      400: {
        description: "Invalid parameters",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 60, window: "1m" },
  },

  // WebSocket
  {
    path: "/ws",
    method: "get",
    summary: "WebSocket Price Stream",
    description:
      "Subscribe to real-time price updates via WebSocket. Authentication optional if WS_AUTH_REQUIRED=false.",
    tags: ["WebSocket", "Real-time"],
    parameters: [
      {
        name: "token",
        schema: z.string().optional(),
        description:
          "Optional HMAC auth token: slabAddress:timestamp:signature",
        in: "query",
      },
    ],
    responses: {
      101: {
        description: "WebSocket connection established",
        schema: z.object({
          type: z.literal("subscribe"),
          slab: Schemas.slabAddress,
        }),
      },
      401: {
        description: "Invalid or missing authentication",
        schema: errorResponse,
      },
      429: {
        description: "Rate limit exceeded (5 connections per IP)",
        schema: errorResponse,
      },
    },
    rateLimit: { requests: 5, window: "1m" },
  },

  {
    path: "/ws/stats",
    method: "get",
    summary: "WebSocket Statistics",
    description:
      "Get statistics about WebSocket connections (active connections, subscriptions, etc.)",
    tags: ["WebSocket"],
    responses: {
      200: {
        description: "WebSocket stats retrieved",
        schema: z.object({
          activeConnections: z.number(),
          activeSubscriptions: z.number(),
          totalMessagesQueued: z.number(),
          peakConnectionsPerMinute: z.number(),
          timestamp: Schemas.timestamp,
        }),
      },
    },
    rateLimit: { requests: 60, window: "1m" },
  },
];

/**
 * Security schemes for OpenAPI spec
 */
export const SECURITY_SCHEMES = {
  apiKeyAuth: {
    type: "apiKey",
    in: "header",
    name: "x-api-key",
    description: "API key for mutation endpoints. Required in production.",
  },
  wsAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "HMAC-SHA256",
    description:
      "HMAC authentication for WebSocket endpoints. Optional if WS_AUTH_REQUIRED=false.",
  },
};

/**
 * Info about the API
 */
export const API_INFO = {
  title: "Percolator Launch API",
  version: "1.0.0",
  description:
    "RESTful API for the Percolator perpetual futures platform on Solana. Enables market discovery, trade data access, real-time price feeds, and performance monitoring.",
  termsOfService: "https://percolatorlaunch.com/terms",
  contact: {
    name: "Percolator Support",
    url: "https://github.com/dcccrypto/percolator-launch",
    email: "support@percolatorlaunch.com",
  },
  license: {
    name: "MIT",
    url: "https://github.com/dcccrypto/percolator-launch/blob/main/LICENSE",
  },
};

/**
 * Servers configuration
 */
export const SERVERS = [
  {
    url: "https://api.percolatorlaunch.com",
    description: "Production API",
    variables: {},
  },
  {
    url: "http://localhost:3001",
    description: "Local development",
    variables: {},
  },
];
