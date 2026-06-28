import type { PageSpeedResult, PageSpeedScores } from "./types";

type PageSpeedApiResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number }>;
    audits?: Record<string, { displayValue?: string }>;
  };
};

function categoryScore(data: PageSpeedApiResponse, key: string): number | undefined {
  const value = data.lighthouseResult?.categories?.[key]?.score;
  return typeof value === "number" ? Math.round(value * 100) : undefined;
}

function auditDisplay(data: PageSpeedApiResponse, id: string): string | undefined {
  return data.lighthouseResult?.audits?.[id]?.displayValue;
}

function parseResult(data: PageSpeedApiResponse): PageSpeedResult {
  return {
    performance: categoryScore(data, "performance"),
    accessibility: categoryScore(data, "accessibility"),
    seo: categoryScore(data, "seo"),
    bestPractices: categoryScore(data, "best-practices"),
    lcp: auditDisplay(data, "largest-contentful-paint"),
    cls: auditDisplay(data, "cumulative-layout-shift"),
    inp: auditDisplay(data, "interaction-to-next-paint"),
    fcp: auditDisplay(data, "first-contentful-paint"),
    ttfb: auditDisplay(data, "server-response-time")
  };
}

async function fetchPageSpeed(url: string, strategy: "mobile" | "desktop", key: string): Promise<PageSpeedResult> {
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", strategy);
  api.searchParams.set("key", key);
  api.searchParams.append("category", "performance");
  api.searchParams.append("category", "accessibility");
  api.searchParams.append("category", "best-practices");
  api.searchParams.append("category", "seo");

  const response = await fetch(api);
  if (!response.ok) {
    throw new Error(`PageSpeed ${strategy} failed with ${response.status}`);
  }

  return parseResult(await response.json());
}

export async function getPageSpeedScores(url: string): Promise<PageSpeedScores> {
  const key = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!key) {
    return { status: "skipped", message: "PageSpeed skipped: missing GOOGLE_PAGESPEED_API_KEY" };
  }

  try {
    const [mobile, desktop] = await Promise.all([fetchPageSpeed(url, "mobile", key), fetchPageSpeed(url, "desktop", key)]);
    return { status: "ok", mobile, desktop };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "PageSpeed request failed" };
  }
}
