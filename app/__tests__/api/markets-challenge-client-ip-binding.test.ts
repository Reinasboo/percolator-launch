import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("POST /api/markets challenge client IP binding", () => {
  it("binds nonce redemption to issuing client_ip", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/markets/route.ts"),
      "utf8",
    );

    expect(source).toContain('import { getClientIp } from "@/lib/get-client-ip"');
    expect(source).toContain("const clientIp = getClientIp(req);");
    expect(source).toContain('.eq("client_ip", clientIp)');
  });
});
