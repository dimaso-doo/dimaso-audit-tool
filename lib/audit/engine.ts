import * as cheerio from "cheerio";
import { detectPlatform, platformNote } from "./platform";
import { getPageSpeedScores } from "./pagespeed";
import { scoreAudit } from "./scoring";
import { summarizeAudit } from "./summary";
import type { AuditIssue, AuditResult, SecurityHeadersAudit } from "./types";
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

function securityHeaders(headers: Headers): SecurityHeadersAudit {
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
}): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (issue: AuditIssue) => issues.push(issue);

  if (!input.finalUrl.startsWith("https://")) {
    add({
      title: "Website does not resolve to HTTPS",
      category: "Security",
      severity: "high",
      confidence: "high",
      source: "crawler",
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
        recommendation: "Review this plugin in WordPress admin. Possibly outdated based on public fingerprint only.",
        requiresAccess: true
      });
    }
  }

  return issues;
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
    wordpressPlugins: wordpress?.plugins
  });
  const scores = scoreAudit(issues, pageSpeed);
  const withoutSummary = {
    auditedAt: new Date().toISOString(),
    universal,
    securityHeaders: security,
    platform,
    wordpress,
    platformNote: platformNote(platform.platform),
    pageSpeed,
    scores,
    issues
  };

  return {
    ...withoutSummary,
    summary: await summarizeAudit(withoutSummary)
  };
}
