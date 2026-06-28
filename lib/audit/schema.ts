import * as cheerio from "cheerio";
import type { SchemaAudit } from "./types";

const targetTypes = ["Organization", "LocalBusiness", "Product", "Article", "FAQPage", "BreadcrumbList"] as const;

function collectJsonLdTypes(value: unknown, types: Set<string>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdTypes(item, types));
    return;
  }

  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") types.add(type);
  if (Array.isArray(type)) type.filter((item): item is string => typeof item === "string").forEach((item) => types.add(item));
  if (record["@graph"]) collectJsonLdTypes(record["@graph"], types);
}

export function auditSchema(html: string): SchemaAudit {
  const $ = cheerio.load(html);
  const detectedTypes = new Set<string>();
  const jsonLdScripts = $('script[type="application/ld+json"]');

  jsonLdScripts.each((_, el) => {
    try {
      collectJsonLdTypes(JSON.parse($(el).text()), detectedTypes);
    } catch {
      // Ignore malformed public JSON-LD but still count the script.
    }
  });

  $("[itemscope][itemtype]").each((_, el) => {
    const itemType = $(el).attr("itemtype") ?? "";
    const match = itemType.match(/schema\.org\/([^/#]+)/i);
    if (match) detectedTypes.add(match[1]);
  });

  return {
    jsonLdCount: jsonLdScripts.length,
    microdataCount: $("[itemscope]").length,
    detectedTypes: [...detectedTypes].sort(),
    targetTypes: Object.fromEntries(targetTypes.map((type) => [type, detectedTypes.has(type)])) as SchemaAudit["targetTypes"]
  };
}
