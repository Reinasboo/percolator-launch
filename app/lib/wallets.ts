/**
 * Detection results for browser wallet extensions.
 * Each boolean indicates whether a particular wallet was detected in the browser environment.
 */
export type InstalledWalletDetector = {
  /** True if Phantom wallet extension is installed and available */
  phantom: boolean;
  /** True if Solflare wallet extension is installed and available */
  solflare: boolean;
  /** True if Backpack wallet extension is installed and available */
  backpack: boolean;
};

/** Prioritized order for wallet selection when multiple wallets are installed */
const ORDER: (keyof InstalledWalletDetector)[] = ["phantom", "solflare", "backpack"];

/**
 * Extract installed wallet IDs from detection results in priority order.
 * Returns only wallets that are actually installed (filtered where boolean is true).
 * 
 * @param detector - Object containing boolean flags for each wallet type
 * @returns Array of installed wallet IDs in priority order (phantom → solflare → backpack)
 * 
 * @example
 * const installed = getInstalledWalletIds({
 *   phantom: true,
 *   solflare: false,
 *   backpack: true
 * }); // → ["phantom", "backpack"]
 */
export function getInstalledWalletIds(detector: InstalledWalletDetector): (keyof InstalledWalletDetector)[] {
  return ORDER.filter((key) => detector[key]);
}

/**
 * Detect which Solana wallet extensions are installed in the browser.
 * Safe for server-side rendering (returns all false on Node.js/SSR).
 * 
 * Works by checking for expected global objects that each wallet extension injects:
 * - Phantom: `window.phantom?.solana?.isPhantom`
 * - Solflare: `window.solflare?.isSolflare`
 * - Backpack: `window.backpack?.isBackpack`
 * 
 * @returns Detection results for all supported wallets. Safe for SSR contexts.
 * 
 * @example
 * // In browser with Phantom installed
 * const wallets = defaultWalletDetector();
 * // → { phantom: true, solflare: false, backpack: false }
 * 
 * // On SSR/Node.js
 * const wallets = defaultWalletDetector();
 * // → { phantom: false, solflare: false, backpack: false }
 */
export function defaultWalletDetector(): InstalledWalletDetector {
  if (typeof window === "undefined") {
    return { phantom: false, solflare: false, backpack: false };
  }

  const win = window as unknown as {
    phantom?: { solana?: { isPhantom?: boolean } };
    solflare?: { isSolflare?: boolean };
    backpack?: { isBackpack?: boolean };
  };

  return {
    phantom: !!win.phantom?.solana?.isPhantom,
    solflare: !!win.solflare?.isSolflare,
    backpack: !!win.backpack?.isBackpack,
  };
}
