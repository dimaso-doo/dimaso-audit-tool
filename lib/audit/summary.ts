import type { AuditResult } from "./types";

function factsForAi(result: Omit<AuditResult, "summary">) {
  return {
    finalUrl: result.universal.finalUrl,
    statusCode: result.universal.statusCode,
    crawl: result.crawl,
    pages: result.pages.map((page) => ({
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      title: page.title,
      metaDescription: Boolean(page.metaDescription),
      h1Count: page.h1Count,
      imagesMissingAlt: page.imagesMissingAlt,
      imagesTotal: page.imagesTotal,
      forms: page.forms
    })),
    links: {
      discovered: result.crawl.linksDiscovered,
      checked: result.crawl.linksChecked,
      broken: result.universal.brokenLinks.length
    },
    scores: result.scores,
    platform: result.platform,
    wordpress: result.wordpress,
    pageSpeed: result.pageSpeed,
    issues: result.issues
  };
}

export async function summarizeAudit(result: Omit<AuditResult, "summary">): Promise<string> {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    const topIssues = result.issues
      .filter((issue) => ["critical", "high", "medium"].includes(issue.severity))
      .slice(0, 4)
      .map((issue) => `- ${issue.title}: ${issue.recommendation}`)
      .join("\n");

    return [
      `Overall score is ${result.scores.overall}/100 across ${result.crawl.pagesAudited} audited page(s). Detected platform: ${result.platform.platform} (${result.platform.confidence} confidence).`,
      topIssues ? `Priority items:\n${topIssues}` : "No high-priority public issues were detected in this MVP audit.",
      result.wordpress ? "WordPress findings are based on public fingerprints and require admin access for confirmation." : undefined
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Summarize website audit facts for a business owner. Do not invent facts. Include uncertainty for public fingerprints and avoid definitive WordPress security/update claims."
          },
          { role: "user", content: JSON.stringify(factsForAi(result)) }
        ]
      })
    });

    if (!response.ok) throw new Error("OpenAI summary failed");
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "AI summary was empty.";
  } catch {
    return `Overall score is ${result.scores.overall}/100. AI summary failed, so this fallback summary was generated from deterministic audit facts.`;
  }
}
