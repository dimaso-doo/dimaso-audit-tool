import { organizationProfiles } from "@/config/organizationProfiles";
import { serviceCatalog } from "@/config/serviceCatalog";
import { runAudit } from "@/lib/audit/engine";
import type { AuditIssue } from "@/lib/audit/types";
import { analyzeIA, deterministicScores, featureGapAnalysis, rebuildRecommendation, scopeEstimate, workflowAudit } from "./analysis";
import { contentInventory } from "./content-inventory";
import { crawlSite } from "./crawler";
import type { DiagnosisFinding, DiagnosisInput, DiagnosisResult } from "./types";

function asFinding(issue: AuditIssue, area: DiagnosisFinding["area"]): DiagnosisFinding {
  return { ...issue, area };
}

function gapFindings(gaps: ReturnType<typeof featureGapAnalysis>): DiagnosisFinding[] {
  return gaps.missingCriticalFeatures.map((feature) => ({
    title: `Missing expected feature: ${feature}`,
    category: "Conversion",
    severity: "medium",
    confidence: "medium",
    source: "conversion_audit",
    area: "workflow",
    evidence: [`Expected feature not clearly detected: ${feature}`],
    businessImpact: "The site may not support an important user journey or operational need for this organization type.",
    recommendation: `Validate whether ${feature} is needed and add it to the rebuild or optimization scope if relevant.`,
    requiresAccess: false
  }));
}

function roadmap(findings: DiagnosisFinding[], recommendation: DiagnosisResult["rebuildRecommendation"]) {
  const sevenDay = findings.slice(0, 5).map((finding) => finding.recommendation);
  return {
    sevenDay: sevenDay.length ? sevenDay : ["Confirm goals, analytics access, and priority user journeys."],
    thirtyDay: [
      "Validate content inventory with the client.",
      "Map missing workflows and integrations.",
      "Prepare IA and scope options based on access-confirmed findings."
    ],
    ninetyDay:
      recommendation.decision === "platform_build" || recommendation.decision === "full_rebuild"
        ? ["Run discovery.", "Approve IA/content model.", "Design and build priority templates.", "Migrate content and launch with redirects."]
        : ["Run optimization sprint.", "Fix priority content and conversion issues.", "Measure results and define care plan."]
  };
}

export async function diagnoseSite(input: DiagnosisInput): Promise<DiagnosisResult> {
  const [pages, audit] = await Promise.all([crawlSite(input.url), runAudit(input.url)]);
  const inventory = contentInventory(pages);
  const ia = analyzeIA(pages[0].html, inventory, input.organizationType);
  const workflows = workflowAudit(pages[0].html, inventory, input.organizationType);
  const gaps = featureGapAnalysis(inventory, input.organizationType, workflows);
  const baseFindings = audit.issues.map((issue) =>
    asFinding(
      issue,
      issue.category === "Tracking"
        ? "tracking"
        : issue.category === "Platform risk"
          ? "platform"
          : issue.category === "Conversion"
            ? "business"
            : issue.category === "SEO"
              ? "content"
              : "technical"
    )
  );
  const findings = [...baseFindings, ...gapFindings(gaps)];
  const scores = deterministicScores({
    findings,
    inventory,
    workflows,
    trackingDetected: audit.tracking.detected.length
  });
  const recommendation = rebuildRecommendation(findings, gaps, workflows);
  const moduleTitles = [
    ...new Set([
      ...gaps.suggestedModulesForRebuild,
      ...(recommendation.decision === "platform_build" ? ["CMS implementation and structured content architecture", "Forms, notifications and operational workflows"] : []),
      ...(scores.trackingMaturity < 60 ? ["Analytics, accessibility and performance optimization"] : []),
      ...(audit.platform.platform === "WordPress" ? ["Security, hosting review, training and maintenance / care plan"] : [])
    ])
  ].filter((title) => serviceCatalog.some((module) => module.title === title));
  const estimate = scopeEstimate(recommendation, moduleTitles);
  const plan = roadmap(findings, recommendation);
  const whatWorks = [
    audit.universal.https ? "Site resolves over HTTPS." : "",
    inventory.length > 1 ? `Public crawl found ${inventory.length} internal pages to work with.` : "",
    audit.tracking.detected.length ? "Some tracking tools are publicly visible." : "",
    audit.schema.detectedTypes.length ? "Structured schema is present on at least one page." : ""
  ].filter(Boolean);
  const access = [...new Set([...recommendation.accessRequiredForConfirmation, ...estimate.accessNeeded])];

  return {
    site: {
      requestedUrl: input.url,
      finalUrl: audit.universal.finalUrl,
      organizationType: input.organizationType,
      primaryGoal: input.primaryGoal,
      crawledPages: inventory.length
    },
    diagnosis: {
      executiveSummary: `${audit.platform.platform} site diagnosed as ${recommendation.decision.replace(/_/g, " ")} with ${recommendation.confidence} confidence.`,
      findings,
      assumptions: ["Public crawl only.", "Forms were not submitted.", "Admin, analytics, hosting, CRM, and CMS status require access."]
    },
    scores,
    rebuildRecommendation: recommendation,
    contentInventory: {
      pages: inventory,
      recommendations: inventory.slice(0, 12).map((page) => `${page.recommendation}: ${page.url}`)
    },
    informationArchitecture: ia,
    workflowAudit: workflows,
    featureGapAnalysis: gaps,
    technicalAudit: { issues: findings.filter((finding) => finding.area === "technical"), securityHeaders: audit.securityHeaders },
    platformAudit: { platform: audit.platform, wordpress: audit.wordpress, notes: [audit.platformNote ?? "Public platform detection only."] },
    conversionAudit: audit.conversion,
    trackingAudit: audit.tracking,
    schemaAudit: audit.schema,
    formAudit: audit.forms,
    migrationRisk: {
      level: inventory.length > 40 || gaps.missingCriticalFeatures.length > 4 ? "high" : inventory.length > 12 ? "medium" : "low",
      reasons: [`${inventory.length} pages crawled`, `${gaps.missingCriticalFeatures.length} missing expected features`, `${inventory.filter((page) => page.recommendation !== "migrate").length} pages need review`]
    },
    scopeEstimate: estimate,
    roadmap: plan,
    clientReport: {
      executiveDiagnosis: `${audit.universal.finalUrl} appears to need ${recommendation.decision.replace(/_/g, " ")} because of business, content, workflow, and technical signals found publicly.`,
      mainRecommendation: recommendation.suggestedNextStep,
      whatIsWorking: whatWorks.length ? whatWorks : ["The site is publicly reachable and can be assessed further with access."],
      mainWebsiteProblems: findings.slice(0, 8).map((finding) => finding.title),
      businessImpact: findings.slice(0, 8).map((finding) => finding.businessImpact),
      roadmap: [...plan.sevenDay, ...plan.thirtyDay.slice(0, 3), ...plan.ninetyDay.slice(0, 3)],
      requiresAccessToConfirm: access
    },
    internalDimasoBrief: {
      leadQuality: estimate.dimasoFit,
      recommendedServiceType: recommendation.decision,
      likelyProjectScope: `${estimate.complexity} complexity, ${estimate.estimatedTimeline}`,
      suggestedDimasoModules: estimate.recommendedModules,
      potentialMaintenanceFit: audit.platform.platform === "WordPress" ? "high" : "medium",
      accessNeeded: access,
      salesDiscoveryQuestions: estimate.questionsForClient,
      risksRedFlags: recommendation.risks,
      suggestedProposalOutline: ["Diagnosis recap", "Recommended service path", "Modules and deliverables", "Discovery assumptions", "Access and timeline"],
      suggestedFirstEmailFollowUp: `Based on the public diagnosis, we recommend a ${recommendation.decision.replace(/_/g, " ")} conversation focused on ${organizationProfiles[input.organizationType].expectedFeatures.slice(0, 3).join(", ")}.`
    }
  };
}
