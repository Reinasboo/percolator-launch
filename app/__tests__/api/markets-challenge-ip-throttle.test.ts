import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("GET /api/markets/challenge per-IP throttle", () => {
  it("enforces a per-IP challenge rate limit", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/markets/challenge/route.ts"),
      "utf8",
    );

    expect(source).toContain("MAX_CHALLENGES_PER_IP_PER_MINUTE = 30");
    expect(source).toContain("function isIpRateLimited(ip: string): boolean");
    expect(source).toContain("if (isIpRateLimited(clientIp))");
    expect(source).toContain("Rate limited — max 30 challenge requests per minute per IP");
  });
});
