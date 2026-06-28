export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";
export type IssueCategory =
  | "Performance"
  | "SEO"
  | "Accessibility"
  | "Security"
  | "Technical health"
  | "Platform risk";

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
    | "platform_detection";
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
  note: string;
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
  pageSpeed: PageSpeedScores;
  scores: ScoreBreakdown;
  issues: AuditIssue[];
  summary: string;
}
