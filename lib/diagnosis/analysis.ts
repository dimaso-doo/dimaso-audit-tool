import * as cheerio from "cheerio";
import { organizationProfiles, type OrganizationType } from "@/config/organizationProfiles";
import { serviceCatalog } from "@/config/serviceCatalog";
import type { ContentInventoryItem, DiagnosisFinding, DiagnosisResult } from "./types";

export function analyzeIA(homeHtml: string, inventory: ContentInventoryItem[], organizationType: OrganizationType) {
  const $ = cheerio.load(homeHtml);
  const navText = (selector: string) =>
    $(selector)
      .find("a")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .slice(0, 20);
  const topNavigation = navText("nav, header").slice(0, 12);
  const footerNavigation = navText("footer").slice(0, 16);
  const profile = organizationProfiles[organizationType];
  const pageTypes = new Set(inventory.map((page) => page.pageType));
  const problems: string[] = [];

  if (!topNavigation.length) problems.push("Top navigation was not clearly detected.");
  if (!pageTypes.has("contact")) problems.push("Contact/action path is not clearly represented in crawled pages.");
  if (inventory.filter((page) => page.pageType === "unknown").length > inventory.length / 2) problems.push("Many pages could not be classified from public labels.");

  return {
    topNavigation,
    footerNavigation,
    problems,
    suggestedTopLevelNavigation: profile.suggestedNav,
    suggestedContentModel: ["Page", "Landing page", "Resource", "Event", "Person/team", "Form workflow"].filter((item) =>
      organizationType === "service_business" ? item !== "Event" : true
    ),
    missingTemplates: profile.expectedFeatures.filter((feature) => !inventory.some((page) => page.url.toLowerCase().includes(feature.replace("_", "-"))))
  };
}

export function workflowAudit(homeHtml: string, inventory: ContentInventoryItem[], organizationType: OrganizationType) {
  const text = `${homeHtml} ${inventory.map((page) => `${page.url} ${page.title}`).join(" ")}`.toLowerCase();
  const workflows = [
    ["contact", /contact|mailto:|tel:/],
    ["newsletter", /newsletter|subscribe/],
    ["booking", /booking|appointment|calendar|calendly/],
    ["event", /event|conference|webinar|registration/],
    ["donation", /donat|givebutter|fundraise/],
    ["membership", /member|join|login/],
    ["ecommerce", /cart|checkout|shopify|woocommerce/],
    ["resource_download", /download|resource|publication|report/],
    ["directory", /directory|filter|search members|people/]
  ] as const;

  return workflows.map(([workflow, pattern]) => {
    const present = pattern.test(text);
    const expected =
      organizationType === "membership"
        ? ["membership", "directory", "event", "resource_download"].includes(workflow)
        : organizationType === "ngo"
          ? ["donation", "newsletter", "event", "resource_download"].includes(workflow)
          : organizationType === "service_business"
            ? ["contact", "booking"].includes(workflow)
            : false;
    const status: DiagnosisResult["workflowAudit"][number]["status"] = present ? "present" : expected ? "missing" : "unclear";

    return {
      workflow,
      status,
      evidence: present ? [`Public ${workflow} wording or URL pattern detected.`] : [],
      businessRisk: present ? "Workflow exists publicly but should still be tested with access." : "Expected user action may be hard to complete or measure.",
      recommendation: present ? "Confirm the full workflow with admin/analytics access." : `Consider adding or clarifying the ${workflow} workflow.`,
      requiresAccess: present
    };
  });
}

export function featureGapAnalysis(inventory: ContentInventoryItem[], organizationType: OrganizationType, workflows: ReturnType<typeof workflowAudit>) {
  const profile = organizationProfiles[organizationType];
  const text = `${inventory.map((page) => `${page.url} ${page.title} ${page.pageType}`).join(" ")} ${workflows.map((workflow) => workflow.workflow).join(" ")}`.toLowerCase();
  const missingCriticalFeatures = profile.expectedFeatures.filter((feature) => !text.includes(feature.replace("_", " ")) && !text.includes(feature.replace("_", "-")));
  const goodExistingFeatures = profile.expectedFeatures.filter((feature) => !missingCriticalFeatures.includes(feature));
  const weakFeatures = workflows.filter((workflow) => workflow.status === "unclear").map((workflow) => workflow.workflow);
  const suggestedModulesForRebuild = serviceCatalog
    .filter((module) => module.whenRecommended.some((tag) => missingCriticalFeatures.join(" ").includes(tag) || tag === organizationType))
    .map((module) => module.title);

  return { missingCriticalFeatures, weakFeatures, goodExistingFeatures, suggestedModulesForRebuild };
}

export function deterministicScores(input: {
  findings: DiagnosisFinding[];
  inventory: ContentInventoryItem[];
  workflows: ReturnType<typeof workflowAudit>;
  trackingDetected: number;
}) {
  const penalty = { critical: 28, high: 18, medium: 10, low: 5, info: 0 };
  const score = (area: DiagnosisFinding["area"], base = 100) =>
    Math.max(
      0,
      input.findings.filter((finding) => finding.area === area).reduce((sum, finding) => sum - penalty[finding.severity], base)
    );

  return {
    technicalHealth: score("technical"),
    contentStructure: Math.max(30, 100 - input.inventory.filter((page) => page.recommendation !== "migrate" && page.recommendation !== "keep").length * 8),
    iaClarity: score("ux"),
    conversionReadiness: score("business"),
    workflowMaturity: Math.max(20, 100 - input.workflows.filter((workflow) => workflow.status === "missing").length * 12),
    trackingMaturity: input.trackingDetected ? 80 : 45,
    platformScalability: score("platform"),
    rebuildReadiness: Math.min(100, 45 + input.findings.filter((finding) => finding.area === "content" || finding.area === "workflow").length * 8),
    maintenanceRisk: Math.max(10, 100 - score("technical"))
  };
}

export function rebuildRecommendation(findings: DiagnosisFinding[], featureGaps: ReturnType<typeof featureGapAnalysis>, workflows: ReturnType<typeof workflowAudit>) {
  const missing = featureGaps.missingCriticalFeatures.length;
  const workflowMissing = workflows.filter((workflow) => workflow.status === "missing").length;
  const high = findings.filter((finding) => finding.severity === "high" || finding.severity === "critical").length;
  const decision: DiagnosisResult["rebuildRecommendation"]["decision"] =
    missing >= 4 || workflowMissing >= 4
      ? "platform_build"
      : missing >= 3
        ? "full_rebuild"
        : high >= 3
          ? "content_restructure"
          : high >= 1
            ? "optimization_sprint"
            : "minor_fixes";
  const confidence: DiagnosisResult["rebuildRecommendation"]["confidence"] = missing + workflowMissing + high >= 4 ? "high" : "medium";

  return {
    decision,
    confidence,
    why: `Recommendation is based on ${missing} missing expected features, ${workflowMissing} missing workflows, and ${high} high-priority findings.`,
    evidence: [...featureGaps.missingCriticalFeatures, ...findings.slice(0, 5).map((finding) => finding.title)],
    risks: findings.filter((finding) => finding.severity !== "low").slice(0, 6).map((finding) => finding.businessImpact),
    suggestedNextStep: decision === "minor_fixes" ? "Run an optimization sprint and confirm analytics access." : "Schedule discovery to validate scope, access, and migration risk.",
    accessRequiredForConfirmation: findings.filter((finding) => finding.requiresAccess).map((finding) => finding.title)
  };
}

export function scopeEstimate(recommendation: ReturnType<typeof rebuildRecommendation>, suggestedModules: string[]) {
  const projectType: DiagnosisResult["scopeEstimate"]["projectType"] =
    recommendation.decision === "minor_fixes" || recommendation.decision === "optimization_sprint"
      ? "optimization_sprint"
      : recommendation.decision === "platform_build"
        ? "platform_build"
        : recommendation.decision;
  const complexity: DiagnosisResult["scopeEstimate"]["complexity"] = suggestedModules.length >= 6 ? "high" : suggestedModules.length >= 3 ? "medium" : "low";
  const estimatedTimeline: DiagnosisResult["scopeEstimate"]["estimatedTimeline"] =
    complexity === "high" ? "10-16 weeks" : complexity === "medium" ? "6-10 weeks" : "3-6 weeks";
  const dimasoFit: DiagnosisResult["scopeEstimate"]["dimasoFit"] = suggestedModules.length >= 3 ? "high" : "medium";

  return {
    projectType,
    complexity,
    estimatedTimeline,
    recommendedModules: suggestedModules.slice(0, 6),
    optionalModules: serviceCatalog.map((module) => module.title).filter((title) => !suggestedModules.includes(title)).slice(0, 4),
    accessNeeded: ["CMS/admin", "analytics", "Search Console", "hosting/DNS where relevant"],
    questionsForClient: ["What business outcome matters most?", "Who owns content decisions?", "What workflows are currently manual?", "What systems must integrate?"],
    dimasoFit,
    internalSalesNotes: ["Do not quote fixed price from public diagnosis.", "Validate workflow and migration assumptions during discovery."]
  };
}
