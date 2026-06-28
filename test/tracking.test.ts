import { describe, expect, it } from "vitest";
import { auditTracking } from "@/lib/audit/tracking";

describe("tracking detection", () => {
  it("detects common analytics and consent hints", () => {
    const audit = auditTracking(`
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
      <script>fbq('init', '123'); clarity('set', 'x', 'y')</script>
      <div id="cookie-consent">Cookie settings</div>
    `);

    expect(audit.detected.map((item) => item.name)).toEqual(
      expect.arrayContaining(["Google Tag Manager", "Meta Pixel", "Microsoft Clarity"])
    );
    expect(audit.consentHints.length).toBeGreaterThan(0);
  });
});
