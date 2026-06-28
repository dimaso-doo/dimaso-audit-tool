import * as cheerio from "cheerio";
import { auditConversion, auditForms } from "@/lib/audit/conversion";
import { auditSchema } from "@/lib/audit/schema";
import { classifyPage } from "./page-classifier";
import type { ContentInventoryItem, CrawledPage } from "./types";

function text(value?: string) {
  return value?.replace(/\s+/g, " ").trim();
}

function absolute(raw: string | undefined, base: string) {
  if (!raw) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

export function contentInventory(pages: CrawledPage[]): ContentInventoryItem[] {
  return pages.map((page) => {
    const $ = cheerio.load(page.html);
    const title = text($("title").first().text());
    const h1 = text($("h1").first().text());
    const schema = auditSchema(page.html);
    const forms = auditForms(page.html, page.finalUrl);
    const conversion = auditConversion(page.html, page.finalUrl, forms);
    const final = new URL(page.finalUrl);
    const links = $("a[href]")
      .map((_, el) => absolute($(el).attr("href"), page.finalUrl))
      .get()
      .filter((href): href is string => Boolean(href));
    const bodyWords = text($("body").text())?.split(/\s+/).filter(Boolean).length ?? 0;
    const noindex = /noindex/i.test($("meta[name='robots']").attr("content") ?? "");
    const missingAlt = $("img").filter((_, el) => !$(el).attr("alt")).length;
    const pageType = classifyPage(page.finalUrl, title, h1);
    const recommendation =
      page.statusCode >= 400 ? "redirect" : bodyWords < 120 && pageType !== "contact" ? "improve" : noindex ? "needs human review" : "migrate";

    return {
      url: page.finalUrl,
      title,
      metaDescription: text($("meta[name='description']").attr("content")),
      h1,
      pageType,
      wordCount: bodyWords,
      statusCode: page.statusCode,
      canonical: absolute($("link[rel='canonical']").attr("href"), page.finalUrl),
      indexabilityHint: noindex ? "noindex hint detected" : "indexable hint",
      internalLinks: links.filter((href) => new URL(href).hostname === final.hostname).length,
      externalLinks: links.filter((href) => new URL(href).hostname !== final.hostname).length,
      imagesCount: $("img").length,
      missingAltCount: missingAlt,
      formsCount: forms.forms.length,
      ctaCount: conversion.ctaCount,
      schemaTypes: schema.detectedTypes,
      lastModified: page.headers["last-modified"],
      recommendation
    };
  });
}
