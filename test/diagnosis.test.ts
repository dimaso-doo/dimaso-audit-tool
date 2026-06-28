import { describe, expect, it } from "vitest";
import { analyzeIA, featureGapAnalysis, rebuildRecommendation, scopeEstimate, workflowAudit } from "@/lib/diagnosis/analysis";
import { contentInventory } from "@/lib/diagnosis/content-inventory";
import { classifyPage } from "@/lib/diagnosis/page-classifier";
import { createDiagnosisPdf } from "@/lib/report/pdf";
import type { CrawledPage, DiagnosisFinding, DiagnosisResult } from "@/lib/diagnosis/types";

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

  it("generates a readable PDF document for diagnosis results", () => {
    const pdf = createDiagnosisPdf({
      site: {
        requestedUrl: "https://example.org",
        finalUrl: "https://example.org/",
        organizationType: "ngo",
        primaryGoal: "resources",
        crawledPages: 2
      },
      diagnosis: { executiveSummary: "Public diagnosis only.", findings: [], assumptions: ["Public crawl only."] },
      scores: {
        technicalHealth: 80,
        contentStructure: 70,
        iaClarity: 75,
        conversionReadiness: 60,
        workflowMaturity: 55,
        trackingMaturity: 45,
        platformScalability: 65,
        rebuildReadiness: 70,
        maintenanceRisk: 35
      },
      rebuildRecommendation: {
        decision: "content_restructure",
        confidence: "medium",
        why: "Based on public diagnosis signals.",
        evidence: ["Missing resource path"],
        risks: ["Users may miss key resources."],
        suggestedNextStep: "Run discovery.",
        accessRequiredForConfirmation: ["Analytics"]
      },
      contentInventory: { pages: contentInventory(pages), recommendations: ["migrate: https://example.org/"] },
      informationArchitecture: {
        topNavigation: ["About", "Resources"],
        footerNavigation: [],
        problems: ["Contact path needs review."],
        suggestedTopLevelNavigation: ["About", "Resources", "Contact"],
        suggestedContentModel: ["Page", "Resource"],
        missingTemplates: ["event"]
      },
      workflowAudit: workflowAudit(pages[0].html, contentInventory(pages), "ngo"),
      featureGapAnalysis: {
        missingCriticalFeatures: ["events"],
        weakFeatures: ["newsletter"],
        goodExistingFeatures: ["resource_library"],
        suggestedModulesForRebuild: ["Discovery, IA and rebuild scope"]
      },
      technicalAudit: { issues: [], securityHeaders: { present: [], missing: [] } },
      platformAudit: { platform: { platform: "Custom / Unknown", confidence: "low", evidence: [] }, notes: ["Public detection only."] },
      conversionAudit: { ctaCount: 1, ctaTexts: ["Contact us"], contactOptions: ["form"], formsCount: 1, trustSignals: [], offerClarity: "moderate", weakButtons: [] },
      trackingAudit: { detected: [], missing: [], consentHints: [] },
      schemaAudit: {
        jsonLdCount: 1,
        microdataCount: 0,
        detectedTypes: ["Organization"],
        targetTypes: {
          Organization: true,
          LocalBusiness: false,
          Product: false,
          Article: false,
          FAQPage: false,
          BreadcrumbList: false
        }
      },
      formAudit: { forms: [] },
      migrationRisk: { level: "medium", reasons: ["Two pages crawled"] },
      scopeEstimate: {
        projectType: "content_restructure",
        complexity: "medium",
        estimatedTimeline: "6-10 weeks",
        recommendedModules: ["Discovery, IA and rebuild scope"],
        optionalModules: [],
        accessNeeded: ["CMS/admin"],
        questionsForClient: ["What outcome matters most?"],
        dimasoFit: "high",
        internalSalesNotes: ["Validate assumptions."]
      },
      roadmap: { sevenDay: ["Confirm goals"], thirtyDay: ["Map content"], ninetyDay: ["Rebuild templates"] },
      clientReport: {
        executiveDiagnosis: "The site needs content restructuring.",
        mainRecommendation: "Run discovery.",
        whatIsWorking: ["Site is reachable."],
        mainWebsiteProblems: ["Content structure is unclear."],
        businessImpact: ["Users may not find resources."],
        roadmap: ["Confirm goals"],
        requiresAccessToConfirm: ["Analytics"]
      },
      internalDimasoBrief: {
        leadQuality: "high",
        recommendedServiceType: "content_restructure",
        likelyProjectScope: "medium complexity, 6-10 weeks",
        suggestedDimasoModules: ["Discovery, IA and rebuild scope"],
        potentialMaintenanceFit: "medium",
        accessNeeded: ["CMS/admin"],
        salesDiscoveryQuestions: ["What outcome matters most?"],
        risksRedFlags: ["Unknown analytics."],
        suggestedProposalOutline: ["Diagnosis recap"],
        suggestedFirstEmailFollowUp: "We recommend a discovery conversation."
      }
    } satisfies DiagnosisResult);

    expect(Buffer.from(pdf).toString("utf8", 0, 8)).toBe("%PDF-1.4");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
