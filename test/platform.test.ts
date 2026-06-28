import { describe, expect, it } from "vitest";
import { detectPlatform } from "@/lib/audit/platform";

describe("platform detection", () => {
  it("detects WordPress from public assets", () => {
    const result = detectPlatform("<html><script src='/wp-content/themes/acme/app.js'></script></html>", [
      "https://site.test/wp-content/plugins/contact-form-7/main.js"
    ]);

    expect(result.platform).toBe("WordPress");
    expect(result.confidence).toBe("high");
  });

  it("detects Shopify from CDN fingerprints", () => {
    const result = detectPlatform("<html>Shopify.theme = {}</html>", ["https://cdn.shopify.com/s/files/theme.css"]);
    expect(result.platform).toBe("Shopify");
  });

  it("falls back to custom unknown", () => {
    const result = detectPlatform("<html><title>Hello</title></html>", []);
    expect(result.platform).toBe("Custom / Unknown");
    expect(result.confidence).toBe("low");
  });
});
