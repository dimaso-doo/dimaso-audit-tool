import * as cheerio from "cheerio";
import { normalizeInputUrl, safeFetch } from "@/lib/audit/urlSafety";
import type { CrawledPage } from "./types";

const MAX_PAGES = 75;

function absolute(raw: string | undefined, base: string) {
  if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return undefined;
  try {
    const url = new URL(raw, base);
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

async function fetchText(url: URL) {
  const { response, finalUrl } = await safeFetch(url, { method: "GET" });
  const html = await response.text();
  const headers = Object.fromEntries(response.headers.entries());
  return { url: url.toString(), finalUrl, html, statusCode: response.status, headers };
}

async function sitemapUrls(origin: string) {
  try {
    const { response } = await safeFetch(new URL("/sitemap.xml", origin), { method: "GET" }, 2);
    if (!response.ok) return [];
    const xml = await response.text();
    return [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => match[1]).slice(0, MAX_PAGES);
  } catch {
    return [];
  }
}

export async function crawlSite(input: string): Promise<CrawledPage[]> {
  const start = normalizeInputUrl(input);
  const home = await fetchText(start);
  const final = new URL(home.finalUrl);
  const $ = cheerio.load(home.html);
  const discovered = new Set<string>([home.finalUrl]);

  $("a[href]").each((_, el) => {
    const href = absolute($(el).attr("href"), home.finalUrl);
    if (href && new URL(href).hostname === final.hostname) discovered.add(href);
  });
  for (const href of await sitemapUrls(final.origin)) {
    try {
      const url = new URL(href);
      if (url.hostname === final.hostname) discovered.add(url.toString());
    } catch {
      // ignore malformed sitemap URL
    }
  }

  const pages: CrawledPage[] = [home];
  for (const href of [...discovered].filter((url) => url !== home.finalUrl).slice(0, MAX_PAGES - 1)) {
    try {
      pages.push(await fetchText(new URL(href)));
    } catch {
      // Skip failed internal pages in v0.1 and keep diagnosis moving.
    }
  }
  return pages;
}
