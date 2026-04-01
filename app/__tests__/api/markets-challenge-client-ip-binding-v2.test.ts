import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("POST /api/markets client IP binding", () => {
  it("requires nonce claim to match the issuing client IP", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/markets/route.ts"),
      "utf8",
    );

    expect(source).toContain('import { getClientIp } from "@/lib/get-client-ip"');
    expect(source).toContain("const clientIp = getClientIp(req);");
    expect(source).toContain('.eq("client_ip", clientIp)');
  });
});
