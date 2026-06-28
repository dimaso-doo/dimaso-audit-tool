export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";
export type IssueCategory =
  | "Performance"
  | "SEO"
  | "Accessibility"
  | "Security"
  | "Technical health"
  | "Platform risk"
  | "Tracking"
  | "Schema"
  | "Conversion";

export interface AuditIssue {
  title: string;
  category: IssueCategory;
  severity: Severity;
  confidence: Confidence;
  source:
    | "html"
    | "headers"
    | "pagespeed"
    | "crawler"
    | "wordpress_fingerprint"
    | "platform_detection"
    | "tracking_detection"
    | "schema_detection"
    | "conversion_audit"
    | "form_audit";
  evidence: string[];
  businessImpact: string;
  recommendation: string;
  requiresAccess: boolean;
}

export interface PlatformDetection {
  platform:
    | "WordPress"
    | "Shopify"
    | "Webflow"
    | "Wix"
    | "Squarespace"
    | "Magento"
    | "Drupal"
    | "Joomla"
    | "Next.js"
    | "React"
    | "Vue"
    | "Custom / Unknown";
  confidence: Confidence;
  evidence: string[];
}

export interface WordpressPluginFinding {
  slug: string;
  name: string;
  detectedVersion?: string;
  latestKnownVersion?: string;
  status: "possibly_outdated" | "current" | "unknown";
  confidence: Confidence;
  source: "public_asset_fingerprint";
  assets: WordpressPluginAssetEvidence[];
  note: string;
}

export interface WordpressPluginAssetEvidence {
  url: string;
  fileType: "css" | "js" | "other";
  detectedVersion?: string;
}

export interface WordpressAudit {
  detectedTraces: string[];
  themeSlug?: string;
  plugins: WordpressPluginFinding[];
  note: string;
}

export interface PageSpeedScores {
  status: "skipped" | "ok" | "error";
  message?: string;
  mobile?: PageSpeedResult;
  desktop?: PageSpeedResult;
}

export interface PageSpeedResult {
  performance?: number;
  accessibility?: number;
  seo?: number;
  bestPractices?: number;
  lcp?: string;
  cls?: string;
  inp?: string;
  fcp?: string;
  ttfb?: string;
}

export interface UniversalAudit {
  requestedUrl: string;
  finalUrl: string;
  https: boolean;
  statusCode: number;
  title?: string;
  metaDescription?: string;
  h1Count: number;
  h1Texts: string[];
  canonical?: string;
  robotsTxtExists: boolean;
  sitemapXmlExists: boolean;
  openGraphTags: number;
  headingStructure: Record<string, number>;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: Array<{ url: string; status?: number; error?: string }>;
  imagesTotal: number;
  imagesMissingAlt: number;
  cssFiles: number;
  jsFiles: number;
  totalDetectedAssets: number;
}

export interface SecurityHeadersAudit {
  present: string[];
  missing: string[];
}

export interface TrackingAudit {
  detected: Array<{
    name: "Google Analytics" | "Google Tag Manager" | "Meta Pixel" | "LinkedIn Insight" | "TikTok Pixel" | "Microsoft Clarity" | "Hotjar";
    evidence: string[];
  }>;
  missing: string[];
  consentHints: string[];
}

export interface SchemaAudit {
  jsonLdCount: number;
  microdataCount: number;
  detectedTypes: string[];
  targetTypes: Record<"Organization" | "LocalBusiness" | "Product" | "Article" | "FAQPage" | "BreadcrumbList", boolean>;
}

export interface ConversionAudit {
  ctaCount: number;
  ctaTexts: string[];
  contactOptions: string[];
  formsCount: number;
  trustSignals: string[];
  offerClarity: "strong" | "moderate" | "weak";
  weakButtons: string[];
}

export interface StaticFormAudit {
  forms: Array<{
    index: number;
    fieldCount: number;
    fields: string[];
    labels: number;
    requiredFields: number;
    hasSubmitButton: boolean;
    method?: string;
    action?: string;
    spamProtectionHints: string[];
  }>;
}

export interface ActionPlan {
  sevenDay: string[];
  thirtyDay: string[];
  requiresAccess: string[];
}

export interface ScoreBreakdown {
  overall: number;
  categories: Record<IssueCategory, number>;
}

export interface AuditResult {
  auditedAt: string;
  universal: UniversalAudit;
  securityHeaders: SecurityHeadersAudit;
  platform: PlatformDetection;
  wordpress?: WordpressAudit;
  platformNote?: string;
  tracking: TrackingAudit;
  schema: SchemaAudit;
  conversion: ConversionAudit;
  forms: StaticFormAudit;
  pageSpeed: PageSpeedScores;
  scores: ScoreBreakdown;
  issues: AuditIssue[];
  actionPlan: ActionPlan;
  summary: string;
}
