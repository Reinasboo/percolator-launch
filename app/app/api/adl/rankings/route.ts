import { type NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

/**
 * GET /api/adl/rankings
 *
 * Proxies to percolator-api GET /api/adl/rankings
 * Query string forwarded unchanged (supports ?market=, ?limit=, etc.)
 */
export async function GET(req: NextRequest) {
  return proxyToApi(req, `/api/adl/rankings`);
}
