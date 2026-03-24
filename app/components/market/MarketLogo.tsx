"use client";

import { FC, useState } from "react";
import Image from "next/image";

interface MarketLogoProps {
  logoUrl?: string | null;
  mintAddress?: string | null;
  symbol?: string;
  size?: "sm" | "md" | "lg";
  /** Override pixel size directly, bypassing the size preset. */
  pixelOverride?: number;
}

const sizes = { sm: 24, md: 32, lg: 48 };

export const MarketLogo: FC<MarketLogoProps> = ({ logoUrl, mintAddress, symbol, size = "md", pixelOverride }) => {
  const [error, setError] = useState(false);
  const [cdnError, setCdnError] = useState(false);
  const px = pixelOverride ?? sizes[size];

  // Try CDN logo when DB logoUrl is unavailable
  const cdnUrl = mintAddress ? `https://img.fotofolio.xyz/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsolana-labs%2Ftoken-list%2Fmain%2Fassets%2Fmainnet%2F${mintAddress}%2Flogo.png&w=${px * 2}&h=${px * 2}` : null;
  const effectiveUrl = logoUrl ?? (cdnError ? null : cdnUrl);

  if (!effectiveUrl || error) {
    // GH#1544: Fallback label priority:
    //   1. Token symbol (up to 4 chars, e.g. "SOL", "BONK")
    //   2. Mint address prefix (first 3 chars) — better than "?" for anonymous markets
    const fallbackLabel = symbol
      ? symbol.slice(0, 4).toUpperCase()
      : mintAddress
        ? mintAddress.slice(0, 3).toUpperCase()
        : "?";
    return (
      <div
        className="flex items-center justify-center border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text-dim)] font-mono font-bold"
        style={{ width: px, height: px, fontSize: px * (fallbackLabel.length > 2 ? 0.28 : 0.4) }}
      >
        {fallbackLabel}
      </div>
    );
  }

  return (
    <Image
      src={effectiveUrl}
      alt={symbol ?? "token"}
      width={px}
      height={px}
      className="border border-[var(--border)]"
      onError={() => {
        if (logoUrl) setError(true);
        else setCdnError(true);
      }}
      unoptimized
    />
  );
};
