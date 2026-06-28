import type { PlatformDetection } from "./types";

interface Candidate {
  platform: PlatformDetection["platform"];
  evidence: string[];
}

function pushIf(candidate: Candidate, condition: boolean, evidence: string) {
  if (condition) candidate.evidence.push(evidence);
}

export function detectPlatform(html: string, assetUrls: string[]): PlatformDetection {
  const lower = html.toLowerCase();
  const assets = assetUrls.map((asset) => asset.toLowerCase());
  const candidates: Candidate[] = [
    { platform: "WordPress", evidence: [] },
    { platform: "Shopify", evidence: [] },
    { platform: "Webflow", evidence: [] },
    { platform: "Wix", evidence: [] },
    { platform: "Squarespace", evidence: [] },
    { platform: "Magento", evidence: [] },
    { platform: "Drupal", evidence: [] },
    { platform: "Joomla", evidence: [] },
    { platform: "Next.js", evidence: [] },
    { platform: "React", evidence: [] },
    { platform: "Vue", evidence: [] }
  ];

  const byName = (name: Candidate["platform"]) => candidates.find((item) => item.platform === name)!;

  pushIf(byName("WordPress"), lower.includes("wp-content") || assets.some((a) => a.includes("/wp-content/")), "/wp-content/ trace");
  pushIf(byName("WordPress"), lower.includes("wp-includes") || assets.some((a) => a.includes("/wp-includes/")), "/wp-includes/ trace");
  pushIf(byName("WordPress"), lower.includes("/wp-content/plugins/") || assets.some((a) => a.includes("/wp-content/plugins/")), "WordPress plugin asset trace");
  pushIf(byName("WordPress"), lower.includes("/wp-content/themes/") || assets.some((a) => a.includes("/wp-content/themes/")), "WordPress theme asset trace");
  pushIf(byName("WordPress"), /<meta[^>]+name=["']generator["'][^>]+wordpress/i.test(html), "WordPress generator meta");

  pushIf(byName("Shopify"), lower.includes("cdn.shopify.com") || assets.some((a) => a.includes("cdn.shopify.com")), "Shopify CDN asset");
  pushIf(byName("Shopify"), lower.includes("shopify.theme") || lower.includes("shopify-features"), "Shopify frontend marker");

  pushIf(byName("Webflow"), lower.includes("webflow.js") || lower.includes("data-wf-page"), "Webflow page marker");
  pushIf(byName("Wix"), lower.includes("wixstatic.com") || lower.includes("x-wix-"), "Wix public marker");
  pushIf(byName("Squarespace"), lower.includes("static1.squarespace.com") || lower.includes("squarespace.com/universal"), "Squarespace asset marker");
  pushIf(byName("Magento"), lower.includes("mage/cookies") || lower.includes("/static/frontend/"), "Magento public asset marker");
  pushIf(byName("Drupal"), lower.includes("drupal-settings-json") || lower.includes("/sites/default/"), "Drupal public marker");
  pushIf(byName("Joomla"), /<meta[^>]+name=["']generator["'][^>]+joomla/i.test(html) || lower.includes("/media/system/js/"), "Joomla public marker");
  pushIf(byName("Next.js"), lower.includes("/_next/static/") || assets.some((a) => a.includes("/_next/static/")), "Next.js static asset");
  pushIf(byName("React"), lower.includes("data-reactroot") || lower.includes("__react") || assets.some((a) => a.includes("react")), "React visible marker");
  pushIf(byName("Vue"), lower.includes("data-v-") || lower.includes("__vue__") || assets.some((a) => a.includes("vue")), "Vue visible marker");

  const sorted = candidates.filter((c) => c.evidence.length > 0).sort((a, b) => b.evidence.length - a.evidence.length);
  const winner = sorted[0];

  if (!winner) {
    return { platform: "Custom / Unknown", confidence: "low", evidence: ["No strong public platform fingerprints found"] };
  }

  return {
    platform: winner.platform,
    confidence: winner.evidence.length >= 2 ? "high" : "medium",
    evidence: winner.evidence
  };
}

export function platformNote(platform: PlatformDetection["platform"]): string | undefined {
  if (platform === "WordPress") return undefined;
  if (["Webflow", "Wix", "Squarespace"].includes(platform)) {
    return `${platform} is a managed platform. External plugin or theme update status is not applicable from public access.`;
  }
  if (platform === "Shopify") {
    return "Shopify traces can reveal themes, apps, or scripts, but external access cannot confirm app update status.";
  }
  if (["Next.js", "React", "Vue", "Custom / Unknown"].includes(platform)) {
    return "Visible frontend libraries can be detected, but backend dependency status cannot be confirmed externally.";
  }
  return "Platform-specific administrative status requires owner access for confirmation.";
}
