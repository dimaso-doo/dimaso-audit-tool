import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditWordPress } from "@/lib/audit/wordpress";

describe("WordPress public fingerprints", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ version: "5.9.8" }), { status: 200 });
      })
    );
  });

  it("captures CSS and JS plugin asset versions for the report", async () => {
    const audit = await auditWordPress(
      "<html><meta name=\"generator\" content=\"WordPress 6.5\"><link href=\"/wp-content/plugins/contact-form-7/includes/css/styles.css?ver=5.7.2\"></html>",
      ["https://example.com/wp-content/plugins/contact-form-7/includes/js/index.js?ver=5.7.2"]
    );

    expect(audit.plugins).toHaveLength(1);
    expect(audit.plugins[0]).toMatchObject({
      slug: "contact-form-7",
      detectedVersion: "5.7.2",
      latestKnownVersion: "5.9.8",
      status: "possibly_outdated"
    });
    expect(audit.plugins[0].assets.map((asset) => asset.fileType).sort()).toEqual(["css", "js"]);
  });
});
