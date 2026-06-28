import semver from "semver";
import * as cheerio from "cheerio";
import type { WordpressAudit, WordpressPluginAssetEvidence, WordpressPluginFinding } from "./types";

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

function pluginAssetFromUrl(raw: string): { slug: string; asset: WordpressPluginAssetEvidence } | undefined {
  const match = raw.match(/\/wp-content\/plugins\/([^/"'?\s]+)[^"'\s<)]*/i);
  if (!match) return undefined;

  const cleanUrl = match[0];
  const lower = cleanUrl.toLowerCase();

  return {
    slug: match[1],
    asset: {
      url: cleanUrl,
      fileType: lower.includes(".css") ? "css" : lower.includes(".js") ? "js" : "other",
      detectedVersion: pluginVersionFromUrl(cleanUrl)
    }
  };
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

function chooseDetectedVersion(assets: WordpressPluginAssetEvidence[]) {
  const versions = assets.map((asset) => asset.detectedVersion).filter((version): version is string => Boolean(version));
  return versions.find((version) => Boolean(semver.valid(version))) ?? versions[0];
}

async function buildPluginFinding(slug: string, assets: WordpressPluginAssetEvidence[]): Promise<WordpressPluginFinding> {
  const detectedVersion = chooseDetectedVersion(assets);
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
    confidence: assets.length > 1 ? "high" : "medium",
    source: "public_asset_fingerprint",
    assets: assets.slice(0, 8),
    note: NOTE
  };
}

export async function auditWordPress(html: string, assetUrls: string[]): Promise<WordpressAudit> {
  const $ = cheerio.load(html);
  const allText = [html, ...assetUrls].join("\n");
  const detectedTraces = new Set<string>();
  const plugins = new Map<string, WordpressPluginAssetEvidence[]>();

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
    const found = pluginAssetFromUrl(match[0]);
    if (!found) continue;
    const current = plugins.get(found.slug) ?? [];
    if (!current.some((asset) => asset.url === found.asset.url)) {
      current.push(found.asset);
    }
    plugins.set(found.slug, current);
  }

  for (const assetUrl of assetUrls) {
    const found = pluginAssetFromUrl(assetUrl);
    if (!found) continue;
    const current = plugins.get(found.slug) ?? [];
    if (!current.some((asset) => asset.url === found.asset.url)) {
      current.push(found.asset);
    }
    plugins.set(found.slug, current);
  }

  const findings = await Promise.all([...plugins.entries()].slice(0, 30).map(([slug, assets]) => buildPluginFinding(slug, assets)));

  return {
    detectedTraces: [...detectedTraces],
    themeSlug,
    plugins: findings,
    note: "Detected public WordPress traces only. Requires WordPress admin access for confirmation."
  };
}
