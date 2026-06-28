import { describe, expect, it } from "vitest";
import { auditSchema } from "@/lib/audit/schema";

describe("schema detection", () => {
  it("detects JSON-LD and microdata schema types", () => {
    const audit = auditSchema(`
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Dimaso"}</script>
      <div itemscope itemtype="https://schema.org/BreadcrumbList"></div>
    `);

    expect(audit.jsonLdCount).toBe(1);
    expect(audit.microdataCount).toBe(1);
    expect(audit.targetTypes.Organization).toBe(true);
    expect(audit.targetTypes.BreadcrumbList).toBe(true);
  });
});
