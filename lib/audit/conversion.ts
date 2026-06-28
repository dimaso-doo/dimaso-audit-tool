import * as cheerio from "cheerio";
import type { ConversionAudit, StaticFormAudit } from "./types";

const ctaPattern = /\b(contact|get|start|book|schedule|buy|shop|quote|demo|call|subscribe|join|register|learn more|sign up|download)\b/i;
const trustPattern = /\b(testimonial|review|case study|certified|award|client|trusted|partner|guarantee|secure|years|rating)\b/i;

function clean(value?: string) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function auditForms(html: string, finalUrl: string): StaticFormAudit {
  const $ = cheerio.load(html);
  const forms = $("form")
    .map((index, form) => {
      const $form = $(form);
      const fields = $form
        .find("input, textarea, select")
        .map((_, field) => clean($(field).attr("name") || $(field).attr("id") || $(field).attr("placeholder") || $(field).attr("type")))
        .get()
        .filter(Boolean);
      const htmlChunk = $.html(form).toLowerCase();

      return {
        index,
        fieldCount: fields.length,
        fields,
        labels: $form.find("label").length,
        requiredFields: $form.find("[required], [aria-required='true']").length,
        hasSubmitButton: $form.find("button[type='submit'], input[type='submit'], button:not([type])").length > 0,
        method: ($form.attr("method") || "get").toUpperCase(),
        action: $form.attr("action") ? new URL($form.attr("action")!, finalUrl).toString() : undefined,
        spamProtectionHints: ["recaptcha", "hcaptcha", "turnstile", "honeypot"].filter((hint) => htmlChunk.includes(hint))
      };
    })
    .get();

  return { forms };
}

export function auditConversion(html: string, finalUrl: string, formsAudit = auditForms(html, finalUrl)): ConversionAudit {
  const $ = cheerio.load(html);
  const ctaTexts = $("a, button")
    .map((_, el) => clean($(el).text() || $(el).attr("aria-label") || $(el).attr("value")))
    .get()
    .filter((value) => ctaPattern.test(value))
    .slice(0, 20);

  const bodyText = clean($("body").text()).toLowerCase();
  const contactOptions = [
    $("a[href^='mailto:']").length > 0 ? "email link" : "",
    $("a[href^='tel:']").length > 0 ? "phone link" : "",
    /contact/.test(bodyText) ? "contact copy" : "",
    formsAudit.forms.length > 0 ? "form" : ""
  ].filter(Boolean);

  const trustSignals = [...new Set((bodyText.match(trustPattern) ? ["trust language"] : []).concat($("[class*='testimonial'], [class*='review'], [class*='logo']").length ? ["visual trust section"] : []))];
  const weakButtons = $("a, button")
    .map((_, el) => clean($(el).text() || $(el).attr("aria-label")))
    .get()
    .filter((value) => !value || /^(click here|submit|read more|learn more)$/i.test(value))
    .slice(0, 10);

  return {
    ctaCount: ctaTexts.length,
    ctaTexts: [...new Set(ctaTexts)].slice(0, 12),
    contactOptions,
    formsCount: formsAudit.forms.length,
    trustSignals,
    offerClarity: ctaTexts.length >= 2 && contactOptions.length ? "strong" : ctaTexts.length ? "moderate" : "weak",
    weakButtons
  };
}
