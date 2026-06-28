import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/audit/engine";

describe("security header parser", () => {
  it("separates present and missing security headers", () => {
    const headers = new Headers({
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "DENY"
    });
    const audit = securityHeaders(headers);

    expect(audit.present).toEqual(expect.arrayContaining(["content-security-policy", "x-frame-options"]));
    expect(audit.missing).toEqual(expect.arrayContaining(["strict-transport-security", "permissions-policy"]));
  });
});
