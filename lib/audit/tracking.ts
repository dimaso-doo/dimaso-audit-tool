import * as cheerio from "cheerio";
import type { TrackingAudit } from "./types";

const trackers: Array<{ name: TrackingAudit["detected"][number]["name"]; patterns: RegExp[] }> = [
  { name: "Google Analytics", patterns: [/google-analytics\.com/i, /googletagmanager\.com\/gtag\/js/i, /\bgtag\(/i, /\bga\(/i, /G-[A-Z0-9]+/i, /UA-\d+-\d+/i] },
  { name: "Google Tag Manager", patterns: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]+/i] },
  { name: "Meta Pixel", patterns: [/connect\.facebook\.net\/.*fbevents\.js/i, /\bfbq\(/i] },
  { name: "LinkedIn Insight", patterns: [/snap\.licdn\.com\/li\.lms-analytics/i, /linkedin_data_partner_ids/i] },
  { name: "TikTok Pixel", patterns: [/analytics\.tiktok\.com\/i18n\/pixel/i, /\bttq\./i] },
  { name: "Microsoft Clarity", patterns: [/clarity\.ms\/tag/i, /\bclarity\(/i] },
  { name: "Hotjar", patterns: [/static\.hotjar\.com/i, /\bhj\(/i, /hotjar/i] }
];

function evidenceFor(html: string, patterns: RegExp[]) {
  return patterns
    .filter((pattern) => pattern.test(html))
    .map((pattern) => pattern.source.replace(/\\/g, ""))
    .slice(0, 4);
}

export function auditTracking(html: string): TrackingAudit {
  const $ = cheerio.load(html);
  const haystack = [
    html,
    ...$("script[src]")
      .map((_, el) => $(el).attr("src") ?? "")
      .get()
  ].join("\n");

  const detected = trackers
    .map((tracker) => ({ name: tracker.name, evidence: evidenceFor(haystack, tracker.patterns) }))
    .filter((tracker) => tracker.evidence.length > 0);

  const detectedNames = new Set(detected.map((tracker) => tracker.name));
  const missing = trackers.map((tracker) => tracker.name).filter((name) => !detectedNames.has(name));
  const consentHints = [/cookie/i, /consent/i, /cmp/i, /onetrust/i, /cookiebot/i, /iubenda/i]
    .filter((pattern) => pattern.test(haystack))
    .map((pattern) => pattern.source.replace(/\\/g, ""));

  return { detected, missing, consentHints };
}
