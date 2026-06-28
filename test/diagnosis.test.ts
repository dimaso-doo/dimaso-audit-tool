import { describe, expect, it } from "vitest";
import { analyzeIA, featureGapAnalysis, rebuildRecommendation, scopeEstimate, workflowAudit } from "@/lib/diagnosis/analysis";
import { contentInventory } from "@/lib/diagnosis/content-inventory";
import { classifyPage } from "@/lib/diagnosis/page-classifier";
import type { CrawledPage, DiagnosisFinding } from "@/lib/diagnosis/types";

const pages: CrawledPage[] = [
  {
    url: "https://example.org/",
    finalUrl: "https://example.org/",
    statusCode: 200,
    headers: {},
    html: `
      <html><body>
        <header><nav><a href="/about">About</a><a href="/resources">Resources</a></nav></header>
        <main>
          <h1>Example Network</h1>
          <p>${"community ".repeat(160)}</p>
          <a href="/contact">Contact us</a>
          <form method="post" action="/contact"><label>Email<input required name="email" /></label><button>Send</button></form>
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Example"}</script>
        </main>
      </body></html>`
  },
  {
    url: "https://example.org/resources/annual-report",
    finalUrl: "https://example.org/resources/annual-report",
    statusCode: 200,
    headers: {},
    html: `<html><body><h1>Annual Report</h1><p>${"report ".repeat(80)}</p></body></html>`
  }
];

describe("diagnosis engine helpers", () => {
  it("classifies common page types", () => {
    expect(classifyPage("https://example.org/about", "About us", "Who we are")).toBe("about");
    expect(classifyPage("https://example.org/resources/report", "Annual Report", "Report")).toBe("resource");
    expect(classifyPage("https://example.org/contact", "Contact", "Contact")).toBe("contact");
  });

  it("builds content inventory without submitting forms", () => {
    const inventory = contentInventory(pages);
    expect(inventory).toHaveLength(2);
    expect(inventory[0].formsCount).toBe(1);
    expect(inventory[0].schemaTypes).toContain("Organization");
    expect(inventory[1].pageType).toBe("resource");
  });

  it("detects information architecture and workflow gaps", () => {
    const inventory = contentInventory(pages);
    const ia = analyzeIA(pages[0].html, inventory, "ngo");
    const workflows = workflowAudit(pages[0].html, inventory, "ngo");
    const gaps = featureGapAnalysis(inventory, "ngo", workflows);

    expect(ia.topNavigation).toContain("Resources");
    expect(workflows.find((item) => item.workflow === "contact")?.status).toBe("present");
    expect(workflows.find((item) => item.workflow === "donation")?.status).toBe("missing");
    expect(gaps.missingCriticalFeatures).toContain("events");
  });

  it("creates deterministic rebuild recommendation and scope estimate", () => {
    const findings: DiagnosisFinding[] = [
      {
        title: "Missing donation path",
        category: "Conversion",
        severity: "high",
        confidence: "medium",
        source: "conversion_audit",
        area: "workflow",
        evidence: ["No donation wording detected"],
        businessImpact: "Fundraising may be blocked.",
        recommendation: "Clarify donation workflow.",
        requiresAccess: false
      }
    ];
    const inventory = contentInventory(pages);
    const workflows = workflowAudit(pages[0].html, inventory, "ngo");
    const gaps = featureGapAnalysis(inventory, "ngo", workflows);
    const recommendation = rebuildRecommendation(findings, gaps, workflows);
    const estimate = scopeEstimate(recommendation, ["Forms, notifications and operational workflows"]);

    expect(["optimization_sprint", "content_restructure", "full_rebuild", "platform_build"]).toContain(recommendation.decision);
    expect(estimate.estimatedTimeline).toMatch(/weeks/);
    expect(estimate.questionsForClient.length).toBeGreaterThan(0);
  });
});
