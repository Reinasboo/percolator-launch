import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("admin session security checks", () => {
  it("requires confirmed email before admin_users lookup", () => {
    const source = readFileSync(
      resolve(__dirname, "../../lib/admin-session.ts"),
      "utf8",
    );

    expect(source).toContain("if (!user.email_confirmed_at)");
    expect(source).toContain("response: NextResponse.json({ error: \"Unauthorized\" }, { status: 401 })");
  });

  it("normalizes email before service-role admin query", () => {
    const source = readFileSync(
      resolve(__dirname, "../../lib/admin-session.ts"),
      "utf8",
    );

    expect(source).toContain("function normalizedEmail(value: string): string");
    expect(source).toContain("const email = normalizedEmail(user.email);");
    expect(source).toContain(".eq(\"email\", email)");
  });
});
