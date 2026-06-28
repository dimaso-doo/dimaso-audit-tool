import { describe, expect, it } from "vitest";
import { auditConversion, auditForms } from "@/lib/audit/conversion";

describe("conversion and static form audit", () => {
  it("detects CTAs, contact options, trust signals, and form metadata without submitting", () => {
    const html = `
      <a href="/contact">Book a demo</a>
      <a href="mailto:test@example.com">Email us</a>
      <section>Trusted by clients with reviews</section>
      <form method="post" action="/lead"><label>Name<input name="name" required></label><button type="submit">Send</button></form>
    `;
    const forms = auditForms(html, "https://example.com");
    const conversion = auditConversion(html, "https://example.com", forms);

    expect(forms.forms[0]).toMatchObject({ fieldCount: 1, labels: 1, requiredFields: 1, hasSubmitButton: true, method: "POST" });
    expect(conversion.ctaCount).toBeGreaterThan(0);
    expect(conversion.contactOptions).toContain("email link");
    expect(conversion.trustSignals.length).toBeGreaterThan(0);
  });
});
