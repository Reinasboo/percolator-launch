/**
 * GET  /api/bugs  — proxy to percolator-api GET /bugs
 * POST /api/bugs  — proxy to percolator-api POST /bugs
 *
 * Business logic (rate limiting, sanitisation, DB writes) lives in
 * percolator-api and is tested there. This file is a thin auth-aware proxy.
 *
 * GET:  Protected by x-api-key (used by Discord bot poller + admin dashboard).
 *       Forwards the key to percolator-api which re-checks it.
 *
 * POST: Public endpoint. Forwards the real client IP so percolator-api can
 *       apply per-IP rate limiting (3 req/hr).
 */

import { NextRequest } from "next/server";
import { requireAuth, UNAUTHORIZED } from "@/lib/api-auth";
import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAuth(req)) return UNAUTHORIZED;

  const apiKey = req.headers.get("x-api-key") ?? "";
  return proxyToApi(req, "/bugs", { "x-api-key": apiKey });
}

export async function POST(req: NextRequest) {
  // Extract real client IP from Vercel/proxy forwarded headers and pass it to
  // percolator-api so that the per-IP rate limiter operates on the actual client.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  return proxyToApi(req, "/bugs", { "x-real-ip": ip }, { includeBody: true });
}
