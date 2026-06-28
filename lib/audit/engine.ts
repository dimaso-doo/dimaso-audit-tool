import * as cheerio from "cheerio";
import { auditConversion, auditForms } from "./conversion";
import { detectPlatform, platformNote } from "./platform";
import { getPageSpeedScores } from "./pagespeed";
import { auditSchema } from "./schema";
import { scoreAudit } from "./scoring";
import { summarizeAudit } from "./summary";
import type { ActionPlan, AuditIssue, AuditResult, ConversionAudit, SchemaAudit, SecurityHeadersAudit, StaticFormAudit, TrackingAudit } from "./types";
import { auditTracking } from "./tracking";
import { auditWordPress } from "./wordpress";
import { normalizeInputUrl, safeFetch } from "./urlSafety";

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy"
];

function text(value?: string) {
  return value?.replace(/\s+/g, " ").trim();
}

function absolute(raw: string | undefined, base: string): string | undefined {
  if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

async function existsAt(root: URL, pathname: string) {
  const url = new URL(pathname, root.origin);
  try {
    const { response } = await safeFetch(url, { method: "GET" }, 2);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkBrokenLinks(urls: string[]) {
  type BrokenLink = { url: string; status?: number; error?: string };
  const checks: Array<Promise<BrokenLink | undefined>> = urls.slice(0, 25).map(async (url) => {
    try {
      const { response } = await safeFetch(new URL(url), { method: "HEAD" }, 2);
      if (response.status === 405) {
        const fallback = await safeFetch(new URL(url), { method: "GET" }, 2);
        return fallback.response.ok ? undefined : { url, status: fallback.response.status };
      }
      return response.ok ? undefined : { url, status: response.status };
    } catch (error) {
      return { url, error: error instanceof Error ? error.message : "Request failed" };
    }
  });

  return (await Promise.all(checks)).filter((item): item is BrokenLink => Boolean(item));
}

export function securityHeaders(headers: Headers): SecurityHeadersAudit {
  const present = SECURITY_HEADERS.filter((header) => Boolean(headers.get(header)));
  const missing = SECURITY_HEADERS.filter((header) => !headers.get(header));
  return { present, missing };
}

function buildIssues(input: {
  finalUrl: string;
  statusCode: number;
  title?: string;
  metaDescription?: string;
  h1Count: number;
  canonical?: string;
  robotsTxtExists: boolean;
  sitemapXmlExists: boolean;
  imagesTotal: number;
  imagesMissingAlt: number;
  brokenLinks: Array<{ url: string }>;
  security: SecurityHeadersAudit;
  platform: string;
  wordpressPlugins?: Array<{ status: string; slug: string }>;
  tracking: TrackingAudit;
  schema: SchemaAudit;
  conversion: ConversionAudit;
  forms: StaticFormAudit;
}): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (issue: Omit<AuditIssue, "evidence" | "businessImpact"> & Partial<Pick<AuditIssue, "evidence" | "businessImpact">>) =>
    issues.push({
      ...issue,
      evidence: issue.evidence ?? [issue.title],
      businessImpact:
        issue.businessImpact ??
        "This can reduce trust, discoverability, conversion rate, or measurement quality until it is reviewed."
    });

  if (!input.finalUrl.startsWith("https://")) {
    add({
      title: "Website does not resolve to HTTPS",
      category: "Security",
      severity: "high",
      confidence: "high",
      source: "crawler",
      evidence: [input.finalUrl],
      businessImpact: "Visitors may see browser warnings or lose trust before converting.",
      recommendation: "Redirect all public traffic to HTTPS and keep certificates valid.",
      requiresAccess: false
    });
  }
  if (input.statusCode >= 400) {
    add({
      title: `Homepage returned HTTP ${input.statusCode}`,
      category: "Technical health",
      severity: "high",
      confidence: "high",
      source: "crawler",
      evidence: [`HTTP ${input.statusCode}`],
      businessImpact: "Search engines and visitors may treat the homepage as unavailable.",
      recommendation: "Fix the homepage response so visitors and crawlers receive a successful status.",
      requiresAccess: false
    });
  }
  if (!input.title) {
    add({
      title: "Missing page title",
      category: "SEO",
      severity: "medium",
      confidence: "high",
      source: "html",
      evidence: ["No <title> value found on the fetched homepage."],
      businessImpact: "Search snippets and browser tabs become less clear, which can reduce organic CTR.",
      recommendation: "Add a unique descriptive title tag to the homepage.",
      requiresAccess: false
    });
  }
  if (!input.metaDescription) {
    add({
      title: "Missing meta description",
      category: "SEO",
      severity: "low",
      confidence: "high",
      source: "html",
      evidence: ["No meta description tag found on the fetched homepage."],
      businessImpact: "Search result snippets may be auto-generated and less persuasive.",
      recommendation: "Add a concise meta description for search snippets and sharing context.",
      requiresAccess: false
    });
  }
  if (input.h1Count !== 1) {
    add({
      title: `Homepage has ${input.h1Count} H1 tags`,
      category: "SEO",
      severity: "medium",
      confidence: "high",
      source: "html",
      evidence: [`H1 count: ${input.h1Count}`],
      businessImpact: "Unclear page hierarchy can weaken topical relevance and accessibility.",
      recommendation: "Use one clear H1 that describes the page topic.",
      requiresAccess: false
    });
  }
  if (!input.canonical) {
    add({
      title: "Missing canonical tag",
      category: "SEO",
      severity: "low",
      confidence: "high",
      source: "html",
      evidence: ["No canonical link tag found."],
      businessImpact: "Duplicate URL variants can dilute SEO signals.",
      recommendation: "Add a canonical link to reduce duplicate URL ambiguity.",
      requiresAccess: false
    });
  }
  if (!input.robotsTxtExists) {
    add({
      title: "robots.txt was not found",
      category: "Technical health",
      severity: "low",
      confidence: "medium",
      source: "crawler",
      evidence: ["/robots.txt did not return a successful response."],
      businessImpact: "Crawler directives and sitemap discovery may be harder to manage.",
      recommendation: "Publish a robots.txt file with intended crawler directives.",
      requiresAccess: false
    });
  }
  if (!input.sitemapXmlExists) {
    add({
      title: "sitemap.xml was not found",
      category: "SEO",
      severity: "low",
      confidence: "medium",
      source: "crawler",
      evidence: ["/sitemap.xml did not return a successful response."],
      businessImpact: "Important URLs may be discovered slower by search engines.",
      recommendation: "Publish an XML sitemap and reference it from robots.txt.",
      requiresAccess: false
    });
  }
  if (input.imagesTotal > 0 && input.imagesMissingAlt > 0) {
    add({
      title: `${input.imagesMissingAlt} images are missing alt text`,
      category: "Accessibility",
      severity: "medium",
      confidence: "high",
      source: "html",
      evidence: [`${input.imagesMissingAlt}/${input.imagesTotal} images missing alt attributes.`],
      businessImpact: "Users relying on assistive technology may miss important content.",
      recommendation: "Add meaningful alt text for informative images and empty alt text for decorative images.",
      requiresAccess: false
    });
  }
  if (input.brokenLinks.length > 0) {
    add({
      title: `${input.brokenLinks.length} checked homepage links appear broken`,
      category: "Technical health",
      severity: "medium",
      confidence: "medium",
      source: "crawler",
      evidence: input.brokenLinks.slice(0, 5).map((link) => link.url),
      businessImpact: "Broken links create dead ends for visitors and can waste crawl budget.",
      recommendation: "Review the reported homepage links and update or remove failing destinations.",
      requiresAccess: false
    });
  }
  for (const header of input.security.missing) {
    add({
      title: `Missing security header: ${header}`,
      category: "Security",
      severity: header === "content-security-policy" ? "medium" : "low",
      confidence: "high",
      source: "headers",
      evidence: [`Missing response header: ${header}`],
      businessImpact: "Missing browser security controls can increase exposure to common client-side risks.",
      recommendation: `Add and test the ${header} response header for the public site.`,
      requiresAccess: false
    });
  }
  for (const plugin of input.wordpressPlugins ?? []) {
    if (plugin.status === "possibly_outdated") {
      add({
        title: `Possible exposed plugin version: ${plugin.slug}`,
        category: "Platform risk",
        severity: "medium",
        confidence: "medium",
        source: "wordpress_fingerprint",
        evidence: [`Public plugin asset trace: ${plugin.slug}`],
        businessImpact: "Public version traces can help prioritize admin-side plugin review.",
        recommendation: "Review this plugin in WordPress admin. Possibly outdated based on public fingerprint only.",
        requiresAccess: true
      });
    }
  }
  if (!input.tracking.detected.some((tracker) => tracker.name === "Google Analytics" || tracker.name === "Google Tag Manager")) {
    add({
      title: "No GA or GTM tracking detected",
      category: "Tracking",
      severity: "medium",
      confidence: "medium",
      source: "tracking_detection",
      evidence: ["No public GA/GTM script markers detected on the homepage."],
      businessImpact: "Marketing performance and conversion attribution may be incomplete.",
      recommendation: "Confirm analytics coverage and install GA4 or GTM where appropriate.",
      requiresAccess: true
    });
  }
  if (input.tracking.detected.length > 0 && input.tracking.consentHints.length === 0) {
    add({
      title: "Tracking detected without obvious consent hints",
      category: "Tracking",
      severity: "low",
      confidence: "low",
      source: "tracking_detection",
      evidence: input.tracking.detected.map((tracker) => tracker.name),
      businessImpact: "Consent implementation may need legal and analytics review.",
      recommendation: "Confirm cookie consent behavior and regional compliance rules.",
      requiresAccess: true
    });
  }
  if (input.schema.jsonLdCount === 0 && input.schema.microdataCount === 0) {
    add({
      title: "No structured schema detected",
      category: "Schema",
      severity: "low",
      confidence: "high",
      source: "schema_detection",
      evidence: ["No JSON-LD or microdata found on the homepage."],
      businessImpact: "The site may miss enhanced search result eligibility.",
      recommendation: "Add relevant Organization, BreadcrumbList, Article, Product, FAQPage, or LocalBusiness schema.",
      requiresAccess: false
    });
  }
  if (input.conversion.ctaCount === 0) {
    add({
      title: "No clear homepage CTA detected",
      category: "Conversion",
      severity: "high",
      confidence: "medium",
      source: "conversion_audit",
      evidence: ["No common CTA text found in links or buttons."],
      businessImpact: "Visitors may not know the next step, reducing lead generation.",
      recommendation: "Add a clear primary CTA above the fold and repeat it near key sections.",
      requiresAccess: false
    });
  }
  if (input.conversion.contactOptions.length === 0) {
    add({
      title: "No obvious contact option detected",
      category: "Conversion",
      severity: "medium",
      confidence: "medium",
      source: "conversion_audit",
      evidence: ["No mailto, tel, contact copy, or form detected on homepage."],
      businessImpact: "Qualified visitors may abandon if they cannot easily contact the business.",
      recommendation: "Expose phone, email, contact page, or lead form paths clearly.",
      requiresAccess: false
    });
  }
  for (const form of input.forms.forms) {
    if (!form.hasSubmitButton || form.labels < form.fieldCount) {
      add({
        title: `Form ${form.index + 1} may need accessibility review`,
        category: "Conversion",
        severity: "low",
        confidence: "medium",
        source: "form_audit",
        evidence: [`Fields: ${form.fieldCount}`, `Labels: ${form.labels}`, `Submit button: ${form.hasSubmitButton}`],
        businessImpact: "Poor form usability can reduce submissions and lead quality.",
        recommendation: "Ensure each visible field has a label and each form has a clear submit button.",
        requiresAccess: false
      });
    }
  }

  return issues;
}

function actionPlan(issues: AuditIssue[]): ActionPlan {
  const priority = issues.filter((issue) => ["critical", "high", "medium"].includes(issue.severity));
  const sevenDay = priority.slice(0, 6).map((issue) => issue.recommendation);
  const thirtyDay = issues.slice(0, 10).map((issue) => `Resolve: ${issue.title}`);
  const requiresAccess = issues.filter((issue) => issue.requiresAccess).map((issue) => issue.title);

  return {
    sevenDay: sevenDay.length ? sevenDay : ["Review the report and confirm the highest-value business goal for the next audit iteration."],
    thirtyDay: thirtyDay.length ? thirtyDay : ["Schedule a follow-up audit after content, tracking, and technical changes are deployed."],
    requiresAccess
  };
}

export async function runAudit(rawUrl: string): Promise<AuditResult> {
  const requested = normalizeInputUrl(rawUrl);
  const { response, finalUrl } = await safeFetch(requested, { method: "GET" });
  const html = await response.text();
  const $ = cheerio.load(html);
  const final = new URL(finalUrl);

  const assetUrls = [
    ...$("script[src]")
      .map((_, el) => absolute($(el).attr("src"), finalUrl))
      .get(),
    ...$("link[href]")
      .map((_, el) => absolute($(el).attr("href"), finalUrl))
      .get(),
    ...$("img[src]")
      .map((_, el) => absolute($(el).attr("src"), finalUrl))
      .get()
  ].filter((url): url is string => Boolean(url));

  const anchors = $("a[href]")
    .map((_, el) => absolute($(el).attr("href"), finalUrl))
    .get()
    .filter((url): url is string => Boolean(url));

  const internalLinks = anchors.filter((href) => new URL(href).hostname === final.hostname);
  const externalLinks = anchors.filter((href) => new URL(href).hostname !== final.hostname);
  const uniqueLinks = [...new Set(anchors)];

  const [robotsTxtExists, sitemapXmlExists, brokenLinks, pageSpeed] = await Promise.all([
    existsAt(final, "/robots.txt"),
    existsAt(final, "/sitemap.xml"),
    checkBrokenLinks(uniqueLinks),
    getPageSpeedScores(finalUrl)
  ]);

  const title = text($("title").first().text());
  const metaDescription = text($('meta[name="description"]').attr("content"));
  const h1Texts = $("h1")
    .map((_, el) => text($(el).text()) ?? "")
    .get()
    .filter(Boolean);
  const headingStructure = Object.fromEntries(["h1", "h2", "h3", "h4", "h5", "h6"].map((level) => [level, $(level).length]));
  const security = securityHeaders(response.headers);
  const platform = detectPlatform(html, assetUrls);
  const tracking = auditTracking(html);
  const schema = auditSchema(html);
  const forms = auditForms(html, finalUrl);
  const conversion = auditConversion(html, finalUrl, forms);
  const wordpress = platform.platform === "WordPress" || platform.evidence.some((item) => item.toLowerCase().includes("wp-"))
    ? await auditWordPress(html, assetUrls)
    : undefined;

  const universal = {
    requestedUrl: requested.toString(),
    finalUrl,
    https: final.protocol === "https:",
    statusCode: response.status,
    title,
    metaDescription,
    h1Count: $("h1").length,
    h1Texts,
    canonical: absolute($('link[rel="canonical"]').attr("href"), finalUrl),
    robotsTxtExists,
    sitemapXmlExists,
    openGraphTags: $('meta[property^="og:"]').length,
    headingStructure,
    internalLinks: internalLinks.length,
    externalLinks: externalLinks.length,
    brokenLinks,
    imagesTotal: $("img").length,
    imagesMissingAlt: $("img").filter((_, el) => !$(el).attr("alt")).length,
    cssFiles: $('link[rel="stylesheet"][href]').length,
    jsFiles: $("script[src]").length,
    totalDetectedAssets: assetUrls.length
  };

  const issues = buildIssues({
    finalUrl,
    statusCode: response.status,
    title,
    metaDescription,
    h1Count: universal.h1Count,
    canonical: universal.canonical,
    robotsTxtExists,
    sitemapXmlExists,
    imagesTotal: universal.imagesTotal,
    imagesMissingAlt: universal.imagesMissingAlt,
    brokenLinks,
    security,
    platform: platform.platform,
    wordpressPlugins: wordpress?.plugins,
    tracking,
    schema,
    conversion,
    forms
  });
  const scores = scoreAudit(issues, pageSpeed);
  const plan = actionPlan(issues);
  const withoutSummary = {
    auditedAt: new Date().toISOString(),
    universal,
    securityHeaders: security,
    platform,
    wordpress,
    platformNote: platformNote(platform.platform),
    tracking,
    schema,
    conversion,
    forms,
    pageSpeed,
    scores,
    issues,
    actionPlan: plan
  };

  return {
    ...withoutSummary,
    summary: await summarizeAudit(withoutSummary)
  };
}
