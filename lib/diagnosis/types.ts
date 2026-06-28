import type { OrganizationType, PrimaryGoal } from "@/config/organizationProfiles";
import type { AuditIssue, PlatformDetection, SecurityHeadersAudit, TrackingAudit, SchemaAudit, ConversionAudit, StaticFormAudit, WordpressAudit } from "@/lib/audit/types";

export type PageType =
  | "home"
  | "service"
  | "product"
  | "category"
  | "blog"
  | "resource"
  | "event"
  | "member"
  | "directory"
  | "contact"
  | "about"
  | "legal"
  | "donation"
  | "booking"
  | "unknown";

export type DiagnosisFinding = AuditIssue & {
  area: "business" | "content" | "ux" | "workflow" | "technical" | "platform" | "tracking" | "migration";
};

export interface DiagnosisInput {
  url: string;
  organizationType: OrganizationType;
  primaryGoal: PrimaryGoal;
}

export interface CrawledPage {
  url: string;
  finalUrl: string;
  html: string;
  statusCode: number;
  headers: Record<string, string>;
}

export interface ContentInventoryItem {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  pageType: PageType;
  wordCount: number;
  statusCode: number;
  canonical?: string;
  indexabilityHint: string;
  internalLinks: number;
  externalLinks: number;
  imagesCount: number;
  missingAltCount: number;
  formsCount: number;
  ctaCount: number;
  schemaTypes: string[];
  lastModified?: string;
  recommendation: "keep" | "improve" | "merge" | "remove" | "migrate" | "redirect" | "rewrite" | "needs human review";
}

export interface DiagnosisResult {
  site: {
    requestedUrl: string;
    finalUrl: string;
    organizationType: OrganizationType;
    primaryGoal: PrimaryGoal;
    crawledPages: number;
  };
  diagnosis: {
    executiveSummary: string;
    findings: DiagnosisFinding[];
    assumptions: string[];
  };
  scores: Record<
    "technicalHealth" | "contentStructure" | "iaClarity" | "conversionReadiness" | "workflowMaturity" | "trackingMaturity" | "platformScalability" | "rebuildReadiness" | "maintenanceRisk",
    number
  >;
  rebuildRecommendation: {
    decision: "minor_fixes" | "optimization_sprint" | "maintenance_takeover" | "content_restructure" | "full_rebuild" | "platform_build";
    confidence: "high" | "medium" | "low";
    why: string;
    evidence: string[];
    risks: string[];
    suggestedNextStep: string;
    accessRequiredForConfirmation: string[];
  };
  contentInventory: {
    pages: ContentInventoryItem[];
    recommendations: string[];
  };
  informationArchitecture: {
    topNavigation: string[];
    footerNavigation: string[];
    problems: string[];
    suggestedTopLevelNavigation: string[];
    suggestedContentModel: string[];
    missingTemplates: string[];
  };
  workflowAudit: Array<{
    workflow: "contact" | "newsletter" | "booking" | "event" | "donation" | "membership" | "ecommerce" | "resource_download" | "directory";
    status: "present" | "missing" | "unclear" | "broken_hint";
    evidence: string[];
    businessRisk: string;
    recommendation: string;
    requiresAccess: boolean;
  }>;
  featureGapAnalysis: {
    missingCriticalFeatures: string[];
    weakFeatures: string[];
    goodExistingFeatures: string[];
    suggestedModulesForRebuild: string[];
  };
  technicalAudit: {
    issues: DiagnosisFinding[];
    securityHeaders: SecurityHeadersAudit;
  };
  platformAudit: {
    platform: PlatformDetection;
    wordpress?: WordpressAudit;
    notes: string[];
  };
  conversionAudit: ConversionAudit;
  trackingAudit: TrackingAudit;
  schemaAudit: SchemaAudit;
  formAudit: StaticFormAudit;
  migrationRisk: {
    level: "low" | "medium" | "high";
    reasons: string[];
  };
  scopeEstimate: {
    projectType: "optimization_sprint" | "maintenance" | "content_restructure" | "full_rebuild" | "platform_build";
    complexity: "low" | "medium" | "high" | "enterprise";
    estimatedTimeline: "1-2 weeks" | "3-6 weeks" | "6-10 weeks" | "10-16 weeks" | "needs discovery";
    recommendedModules: string[];
    optionalModules: string[];
    accessNeeded: string[];
    questionsForClient: string[];
    dimasoFit: "low" | "medium" | "high";
    internalSalesNotes: string[];
  };
  roadmap: {
    sevenDay: string[];
    thirtyDay: string[];
    ninetyDay: string[];
  };
  clientReport: {
    executiveDiagnosis: string;
    mainRecommendation: string;
    whatIsWorking: string[];
    mainWebsiteProblems: string[];
    businessImpact: string[];
    roadmap: string[];
    requiresAccessToConfirm: string[];
  };
  internalDimasoBrief: {
    leadQuality: "low" | "medium" | "high";
    recommendedServiceType: string;
    likelyProjectScope: string;
    suggestedDimasoModules: string[];
    potentialMaintenanceFit: "low" | "medium" | "high";
    accessNeeded: string[];
    salesDiscoveryQuestions: string[];
    risksRedFlags: string[];
    suggestedProposalOutline: string[];
    suggestedFirstEmailFollowUp: string;
  };
}
