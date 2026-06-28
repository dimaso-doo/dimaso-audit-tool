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

  it("prefers a latest-known asset match over older library asset versions", async () => {
    const audit = await auditWordPress("", [
      "https://example.com/wp-content/plugins/wp-rss-aggregator/core/css/jquery-colorbox.css?ver=1.4.33",
      "https://example.com/wp-content/plugins/wp-rss-aggregator/core/css/displays.css?ver=5.9.8",
      "https://example.com/wp-content/plugins/wp-rss-aggregator/core/js/htmx.min.js?ver=1.9.12"
    ]);

    expect(audit.plugins[0]).toMatchObject({
      slug: "wp-rss-aggregator",
      detectedVersion: "5.9.8",
      latestKnownVersion: "5.9.8",
      status: "current"
    });
  });

  it("ignores wildcard plugin paths that are not real slugs", async () => {
    const audit = await auditWordPress("", ["/wp-content/plugins/*"]);
    expect(audit.plugins).toHaveLength(0);
  });
});
