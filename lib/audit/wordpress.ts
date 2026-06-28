import semver from "semver";
import * as cheerio from "cheerio";
import type { WordpressAudit, WordpressPluginFinding } from "./types";

const NOTE = "Based on public asset fingerprints. Exact update status requires WordPress admin access.";

function readablePluginName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pluginVersionFromUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw, "https://example.com");
    const version = url.searchParams.get("ver") ?? undefined;
    return version && semver.valid(version) ? version : version;
  } catch {
    return undefined;
  }
}

async function fetchWordPressPluginLatest(slug: string): Promise<string | undefined> {
  const endpoint = `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${encodeURIComponent(slug)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { version?: string; error?: string };
    return data.error ? undefined : data.version;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildPluginFinding(slug: string, urls: string[]): Promise<WordpressPluginFinding> {
  const detectedVersion = urls.map(pluginVersionFromUrl).find(Boolean);
  const latestKnownVersion = await fetchWordPressPluginLatest(slug);
  let status: WordpressPluginFinding["status"] = "unknown";

  if (detectedVersion && latestKnownVersion && semver.valid(detectedVersion) && semver.valid(latestKnownVersion)) {
    status = semver.lt(detectedVersion, latestKnownVersion) ? "possibly_outdated" : "current";
  }

  return {
    slug,
    name: readablePluginName(slug),
    detectedVersion,
    latestKnownVersion,
    status,
    confidence: urls.length > 1 ? "high" : "medium",
    source: "public_asset_fingerprint",
    note: NOTE
  };
}

export async function auditWordPress(html: string, assetUrls: string[]): Promise<WordpressAudit> {
  const $ = cheerio.load(html);
  const allText = [html, ...assetUrls].join("\n");
  const detectedTraces = new Set<string>();
  const plugins = new Map<string, string[]>();

  if (allText.includes("/wp-content/")) detectedTraces.add("/wp-content/");
  if (allText.includes("/wp-includes/")) detectedTraces.add("/wp-includes/");
  if (allText.includes("/wp-json/")) detectedTraces.add("/wp-json/");
  if ($('meta[name="generator"]').attr("content")?.toLowerCase().includes("wordpress")) {
    detectedTraces.add("WordPress generator meta tag");
  }

  const themeMatch = allText.match(/\/wp-content\/themes\/([^/"'?\s]+)/i);
  const themeSlug = themeMatch?.[1];
  if (themeSlug) detectedTraces.add(`Detected public theme trace: ${themeSlug}`);

  const pluginRegex = /\/wp-content\/plugins\/([^/"'?\s]+)[^"'\s<)]*/gi;
  let match: RegExpExecArray | null;
  while ((match = pluginRegex.exec(allText))) {
    const slug = match[1];
    const found = plugins.get(slug) ?? [];
    found.push(match[0]);
    plugins.set(slug, found);
  }

  const findings = await Promise.all([...plugins.entries()].slice(0, 20).map(([slug, urls]) => buildPluginFinding(slug, urls)));

  return {
    detectedTraces: [...detectedTraces],
    themeSlug,
    plugins: findings,
    note: "Detected public WordPress traces only. Requires WordPress admin access for confirmation."
  };
}
