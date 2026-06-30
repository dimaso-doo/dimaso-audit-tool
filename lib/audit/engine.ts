import * as cheerio from "cheerio";
import { detectPlatform, platformNote } from "./platform";
import { getPageSpeedScores } from "./pagespeed";
import { scoreAudit } from "./scoring";
import { summarizeAudit } from "./summary";
import type { AuditIssue, AuditResult, BrokenLink, FormAudit, PageAudit, SecurityHeadersAudit } from "./types";
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

const DEFAULT_MAX_PAGES = Number(process.env.AUDIT_MAX_PAGES ?? 50);
const MAX_LINK_CHECKS = Number(process.env.AUDIT_MAX_LINK_CHECKS ?? 500);

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

function sameHost(url: string, hostname: string) {
  try {
    return new URL(url).hostname === hostname;
  } catch {
    return false;
  }
}

function normalizedPageKey(raw: string) {
  const url = new URL(raw);
  url.hash = "";
  for (const param of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|msclkid$)/i.test(param)) {
      url.searchParams.delete(param);
    }
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function pageAssets($: cheerio.CheerioAPI, finalUrl: string) {
  return [
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
}

function pageAnchors($: cheerio.CheerioAPI, finalUrl: string) {
  return $("a[href]")
    .map((_, el) => absolute($(el).attr("href"), finalUrl))
    .get()
    .filter((url): url is string => Boolean(url));
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

type LinkReference = {
  url: string;
  sourcePage: string;
};

async function checkBrokenLinks(links: LinkReference[]) {
  const sourcePages = new Map<string, Set<string>>();
  for (const link of links) {
    const pages = sourcePages.get(link.url) ?? new Set<string>();
    pages.add(link.sourcePage);
    sourcePages.set(link.url, pages);
  }

  const urls = [...sourcePages.keys()];
  const checks: Array<Promise<BrokenLink | undefined>> = urls.slice(0, MAX_LINK_CHECKS).map(async (url) => {
    const sources = [...(sourcePages.get(url) ?? [])];
    try {
      const { response } = await safeFetch(new URL(url), { method: "HEAD" }, 2);
      if (response.status === 405) {
        const fallback = await safeFetch(new URL(url), { method: "GET" }, 2);
        return fallback.response.ok ? undefined : { url, status: fallback.response.status, sourcePages: sources };
      }
      return response.ok ? undefined : { url, status: response.status, sourcePages: sources };
    } catch (error) {
      return { url, error: error instanceof Error ? error.message : "Request failed", sourcePages: sources };
    }
  });

  return (await Promise.all(checks)).filter((item): item is BrokenLink => Boolean(item));
}

function hasAccessibleName($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]) {
  const input = $(el);
  const id = input.attr("id");
  const hasLabelFor = id ? $(`label[for="${id.replace(/"/g, '\\"')}"]`).length > 0 : false;
  const wrappedByLabel = input.parents("label").length > 0;
  return Boolean(
    input.attr("aria-label") ||
      input.attr("aria-labelledby") ||
      input.attr("placeholder") ||
      hasLabelFor ||
      wrappedByLabel
  );
}

function auditForms($: cheerio.CheerioAPI): FormAudit {
  const forms = $("form");
  let formsMissingAction = 0;
  let formsUsingGet = 0;
  let formsUsingPost = 0;
  let formsWithoutSubmit = 0;
  let inputsTotal = 0;
  let inputsMissingName = 0;
  let inputsMissingLabel = 0;

  forms.each((_, form) => {
    const current = $(form);
    const method = (current.attr("method") ?? "get").toLowerCase();
    if (!current.attr("action")) formsMissingAction += 1;
    if (method === "post") formsUsingPost += 1;
    if (method === "get") formsUsingGet += 1;
    if (current.find('button[type="submit"], input[type="submit"], button:not([type]), input[type="image"]').length === 0) {
      formsWithoutSubmit += 1;
    }

    current.find("input, select, textarea").each((_, control) => {
      const type = ($(control).attr("type") ?? "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) return;
      inputsTotal += 1;
      if (!$(control).attr("name")) inputsMissingName += 1;
      if (!hasAccessibleName($, control)) inputsMissingLabel += 1;
    });
  });

  return {
    formsTotal: forms.length,
    formsMissingAction,
    formsUsingGet,
    formsUsingPost,
    formsWithoutSubmit,
    inputsTotal,
    inputsMissingName,
    inputsMissingLabel
  };
}

function securityHeaders(headers: Headers): SecurityHeadersAudit {
  const present = SECURITY_HEADERS.filter((header) => Boolean(headers.get(header)));
  const missing = SECURITY_HEADERS.filter((header) => !headers.get(header));
  return { present, missing };
}

function buildPageIssues(input: {
  page: PageAudit;
  brokenLinks: BrokenLink[];
}): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (issue: AuditIssue) => issues.push({ ...issue, url: input.page.finalUrl });
  const label = input.page.finalUrl;

  if (input.page.statusCode >= 400) {
    add({
      title: `Page returned HTTP ${input.page.statusCode}`,
      category: "Technical health",
      severity: "high",
      confidence: "high",
      source: "crawler",
      recommendation: `Fix ${label} so visitors and crawlers receive a successful status.`,
      requiresAccess: false
    });
  }
  if (!input.page.title) {
    add({
      title: "Missing page title",
      category: "SEO",
      severity: "medium",
      confidence: "high",
      source: "html",
      recommendation: `Add a unique descriptive title tag to ${label}.`,
      requiresAccess: false
    });
  }
  if (!input.page.metaDescription) {
    add({
      title: "Missing meta description",
      category: "SEO",
      severity: "low",
      confidence: "high",
      source: "html",
      recommendation: `Add a concise meta description to ${label}.`,
      requiresAccess: false
    });
  }
  if (input.page.h1Count !== 1) {
    add({
      title: `Page has ${input.page.h1Count} H1 tags`,
      category: "SEO",
      severity: "medium",
      confidence: "high",
      source: "html",
      recommendation: `Use one clear H1 on ${label} that describes the page topic.`,
      requiresAccess: false
    });
  }
  if (!input.page.canonical) {
    add({
      title: "Missing canonical tag",
      category: "SEO",
      severity: "low",
      confidence: "high",
      source: "html",
      recommendation: `Add a canonical link to ${label} to reduce duplicate URL ambiguity.`,
      requiresAccess: false
    });
  }
  if (input.page.imagesTotal > 0 && input.page.imagesMissingAlt > 0) {
    add({
      title: `${input.page.imagesMissingAlt} images are missing alt text`,
      category: "Accessibility",
      severity: "medium",
      confidence: "high",
      source: "html",
      recommendation: `Add meaningful alt text for informative images on ${label}, with empty alt text for decorative images.`,
      requiresAccess: false
    });
  }
  if (input.page.forms.formsMissingAction > 0) {
    add({
      title: `${input.page.forms.formsMissingAction} forms are missing action attributes`,
      category: "Technical health",
      severity: "medium",
      confidence: "high",
      source: "html",
      recommendation: `Set explicit action URLs for forms on ${label}, or document intentionally client-handled forms.`,
      requiresAccess: false
    });
  }
  if (input.page.forms.formsWithoutSubmit > 0) {
    add({
      title: `${input.page.forms.formsWithoutSubmit} forms have no submit control`,
      category: "Technical health",
      severity: "medium",
      confidence: "high",
      source: "html",
      recommendation: `Add a clear submit button/control to forms on ${label}.`,
      requiresAccess: false
    });
  }
  if (input.page.forms.inputsMissingName > 0) {
    add({
      title: `${input.page.forms.inputsMissingName} form fields are missing name attributes`,
      category: "Technical health",
      severity: "medium",
      confidence: "high",
      source: "html",
      recommendation: `Add name attributes to form fields on ${label} so submitted data is identifiable.`,
      requiresAccess: false
    });
  }
  if (input.page.forms.inputsMissingLabel > 0) {
    add({
      title: `${input.page.forms.inputsMissingLabel} form fields may be missing accessible labels`,
      category: "Accessibility",
      severity: "medium",
      confidence: "medium",
      source: "html",
      recommendation: `Connect form fields on ${label} to visible labels, aria-label, or aria-labelledby.`,
      requiresAccess: false
    });
  }

  for (const brokenLink of input.brokenLinks) {
    add({
      title: `Broken link: ${brokenLink.url}`,
      category: "Technical health",
      severity: "medium",
      confidence: "medium",
      source: "crawler",
      recommendation: `Update or remove this link on ${label}. ${brokenLink.status ? `HTTP ${brokenLink.status}.` : brokenLink.error ?? ""}`,
      requiresAccess: false
    });
  }

  return issues;
}

function buildSiteIssues(input: {
  finalUrl: string;
  statusCode: number;
  robotsTxtExists: boolean;
  sitemapXmlExists: boolean;
  brokenLinks: BrokenLink[];
  security: SecurityHeadersAudit;
  platform: string;
  wordpressPlugins?: Array<{ status: string; slug: string }>;
  pagesAudited: number;
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
  if (input.brokenLinks.length > 0) {
    add({
      title: `${input.brokenLinks.length} checked links appear broken`,
      category: "Technical health",
      severity: "medium",
      confidence: "medium",
      source: "crawler",
      recommendation: "Review the reported links across audited pages and update or remove failing destinations.",
      requiresAccess: false
    });
  }
  if (input.pagesAudited <= 1) {
    add({
      title: "Only one page was available for the domain audit",
      category: "Technical health",
      severity: "info",
      confidence: "medium",
      source: "crawler",
      recommendation: "Check sitemap.xml and internal links if the website should expose more public pages.",
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

async function sitemapUrls(root: URL): Promise<string[]> {
  const seen = new Set<string>();
  const urls: string[] = [];
  const queue = [new URL("/sitemap.xml", root.origin).toString()];

  while (queue.length && seen.size < 8 && urls.length < DEFAULT_MAX_PAGES * 2) {
    const sitemapUrl = queue.shift()!;
    if (seen.has(sitemapUrl)) continue;
    seen.add(sitemapUrl);

    try {
      const { response } = await safeFetch(new URL(sitemapUrl), { method: "GET" }, 2);
      if (!response.ok) continue;
      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      $("sitemap > loc").each((_, el) => {
        const loc = text($(el).text());
        if (loc && sameHost(loc, root.hostname)) queue.push(loc);
      });
      $("url > loc").each((_, el) => {
        const loc = text($(el).text());
        if (loc && sameHost(loc, root.hostname)) urls.push(loc);
      });
    } catch {
      continue;
    }
  }

  return [...new Set(urls.map(normalizedPageKey))];
}

async function auditPage(url: URL, scopeHostname: string) {
  const { response, finalUrl } = await safeFetch(url, { method: "GET" });
  const contentType = response.headers.get("content-type") ?? "";
  const html = !contentType || contentType.includes("text/html") || contentType.includes("application/xhtml")
    ? await response.text()
    : "";
  const $ = cheerio.load(html);
  const final = new URL(finalUrl);
  const effectiveScopeHostname = scopeHostname || final.hostname;
  const anchors = pageAnchors($, finalUrl);
  const internalLinks = anchors.filter((href) => sameHost(href, effectiveScopeHostname)).map(normalizedPageKey);
  const externalLinks = anchors.filter((href) => !sameHost(href, effectiveScopeHostname));
  const assetUrls = pageAssets($, finalUrl);
  const h1Texts = $("h1")
    .map((_, el) => text($(el).text()) ?? "")
    .get()
    .filter(Boolean);
  const headingStructure = Object.fromEntries(["h1", "h2", "h3", "h4", "h5", "h6"].map((level) => [level, $(level).length]));

  const page: PageAudit = {
    url: url.toString(),
    finalUrl,
    statusCode: response.status,
    title: text($("title").first().text()),
    metaDescription: text($('meta[name="description"]').attr("content")),
    h1Count: $("h1").length,
    h1Texts,
    canonical: absolute($('link[rel="canonical"]').attr("href"), finalUrl),
    openGraphTags: $('meta[property^="og:"]').length,
    headingStructure,
    internalLinks: internalLinks.length,
    externalLinks: externalLinks.length,
    imagesTotal: $("img").length,
    imagesMissingAlt: $("img").filter((_, el) => !$(el).attr("alt")).length,
    cssFiles: $('link[rel="stylesheet"][href]').length,
    jsFiles: $("script[src]").length,
    totalDetectedAssets: assetUrls.length,
    forms: auditForms($)
  };

  return {
    page,
    html,
    headers: response.headers,
    assetUrls,
    links: anchors.map((anchor) => ({ url: anchor, sourcePage: finalUrl })),
    internalUrls: final.hostname === effectiveScopeHostname ? internalLinks : []
  };
}

export async function runAudit(rawUrl: string): Promise<AuditResult> {
  const requested = normalizeInputUrl(rawUrl);
  const first = await auditPage(requested, "");
  const final = new URL(first.page.finalUrl);
  const scopeHostname = final.hostname;
  const maxPages = Math.max(1, Math.min(DEFAULT_MAX_PAGES, 250));

  const [robotsTxtExists, sitemapXmlExists, sitemapCandidates, pageSpeed] = await Promise.all([
    existsAt(final, "/robots.txt"),
    existsAt(final, "/sitemap.xml"),
    sitemapUrls(final),
    getPageSpeedScores(first.page.finalUrl)
  ]);

  const queued = new Set<string>([normalizedPageKey(first.page.finalUrl)]);
  const queue = [...sitemapCandidates, ...first.internalUrls].filter((url) => {
    if (!sameHost(url, scopeHostname)) return false;
    const key = normalizedPageKey(url);
    if (queued.has(key)) return false;
    queued.add(key);
    return true;
  });

  const pageResults = [first];
  let pagesFailed = 0;

  while (queue.length && pageResults.length < maxPages) {
    const next = queue.shift()!;
    try {
      const result = await auditPage(new URL(next), scopeHostname);
      const key = normalizedPageKey(result.page.finalUrl);
      if (queued.has(key) && pageResults.some((item) => normalizedPageKey(item.page.finalUrl) === key)) continue;
      queued.add(key);
      pageResults.push(result);

      for (const href of result.internalUrls) {
        const hrefKey = normalizedPageKey(href);
        if (!queued.has(hrefKey) && queue.length + pageResults.length < maxPages * 2) {
          queued.add(hrefKey);
          queue.push(href);
        }
      }
    } catch {
      pagesFailed += 1;
    }
  }

  const pages = pageResults.map((item) => item.page);
  const allLinks = pageResults.flatMap((item) => item.links);
  const brokenLinks = await checkBrokenLinks(allLinks);
  const allHtml = pageResults.map((item) => item.html).join("\n");
  const allAssetUrls = [...new Set(pageResults.flatMap((item) => item.assetUrls))];
  const security = securityHeaders(first.headers);
  const platform = detectPlatform(allHtml, allAssetUrls);
  const wordpress = platform.platform === "WordPress" || platform.evidence.some((item) => item.toLowerCase().includes("wp-"))
    ? await auditWordPress(allHtml, allAssetUrls)
    : undefined;

  const universal = {
    requestedUrl: requested.toString(),
    finalUrl: first.page.finalUrl,
    https: final.protocol === "https:",
    statusCode: first.page.statusCode,
    title: first.page.title,
    metaDescription: first.page.metaDescription,
    h1Count: first.page.h1Count,
    h1Texts: first.page.h1Texts,
    canonical: first.page.canonical,
    robotsTxtExists,
    sitemapXmlExists,
    openGraphTags: pages.reduce((sum, page) => sum + page.openGraphTags, 0),
    headingStructure: pages.reduce<Record<string, number>>((acc, page) => {
      for (const [level, count] of Object.entries(page.headingStructure)) {
        acc[level] = (acc[level] ?? 0) + count;
      }
      return acc;
    }, {}),
    internalLinks: pages.reduce((sum, page) => sum + page.internalLinks, 0),
    externalLinks: pages.reduce((sum, page) => sum + page.externalLinks, 0),
    brokenLinks,
    imagesTotal: pages.reduce((sum, page) => sum + page.imagesTotal, 0),
    imagesMissingAlt: pages.reduce((sum, page) => sum + page.imagesMissingAlt, 0),
    cssFiles: pages.reduce((sum, page) => sum + page.cssFiles, 0),
    jsFiles: pages.reduce((sum, page) => sum + page.jsFiles, 0),
    totalDetectedAssets: allAssetUrls.length,
    pagesAudited: pages.length,
    formsTotal: pages.reduce((sum, page) => sum + page.forms.formsTotal, 0),
    formsMissingAction: pages.reduce((sum, page) => sum + page.forms.formsMissingAction, 0),
    formsWithoutSubmit: pages.reduce((sum, page) => sum + page.forms.formsWithoutSubmit, 0),
    inputsMissingName: pages.reduce((sum, page) => sum + page.forms.inputsMissingName, 0),
    inputsMissingLabel: pages.reduce((sum, page) => sum + page.forms.inputsMissingLabel, 0)
  };

  const brokenLinksByPage = new Map<string, BrokenLink[]>();
  for (const brokenLink of brokenLinks) {
    for (const sourcePage of brokenLink.sourcePages) {
      const pageLinks = brokenLinksByPage.get(sourcePage) ?? [];
      pageLinks.push(brokenLink);
      brokenLinksByPage.set(sourcePage, pageLinks);
    }
  }

  const issues = [
    ...buildSiteIssues({
      finalUrl: first.page.finalUrl,
      statusCode: first.page.statusCode,
      robotsTxtExists,
      sitemapXmlExists,
      brokenLinks,
      security,
      platform: platform.platform,
      wordpressPlugins: wordpress?.plugins,
      pagesAudited: pages.length
    }),
    ...pages.flatMap((page) => buildPageIssues({ page, brokenLinks: brokenLinksByPage.get(page.finalUrl) ?? [] }))
  ];
  const scores = scoreAudit(issues, pageSpeed);
  const withoutSummary = {
    auditedAt: new Date().toISOString(),
    universal,
    crawl: {
      scope: scopeHostname,
      limit: maxPages,
      pagesDiscovered: queued.size,
      pagesAudited: pages.length,
      pagesFailed,
      linksDiscovered: new Set(allLinks.map((link) => link.url)).size,
      linksChecked: Math.min(new Set(allLinks.map((link) => link.url)).size, MAX_LINK_CHECKS),
      sources: ["start_url", sitemapCandidates.length ? "sitemap.xml" : undefined, first.internalUrls.length ? "internal_links" : undefined].filter(
        (source): source is string => Boolean(source)
      )
    },
    pages,
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
