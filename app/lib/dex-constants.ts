/**
 * Shared DEX constants used across API routes and client hooks.
 * Single source of truth for DEX configuration - centralized here to affect all consumers.
 * 
 * These constants define which decentralized exchanges are supported for:
 * - Hyperp EMA oracle mode (price feeds from DEX pools)
 * - Market creation and validation
 * - Price oracle bootstrapping
 */

/**
 * Set of DEX identifiers supported for Hyperp EMA oracle mode.
 * Hyperp allows launching markets using DEX pool prices as the oracle feed,
 * eliminating need for external oracle feeds for permissionless markets.
 * 
 * Supported DEXes:
 * - **pumpswap**: Pump.fun's DEX integration
 * - **raydium**: Raydium Liquidity Pools (AMM)
 * - **meteora**: Meteora's concentrated liquidity pools
 */
export const SUPPORTED_DEX_IDS = new Set(["pumpswap", "raydium", "meteora"]);

