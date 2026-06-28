import { describe, expect, it } from "vitest";
import { scoreAudit } from "@/lib/audit/scoring";
import type { AuditIssue } from "@/lib/audit/types";

describe("deterministic scoring", () => {
  it("applies severity penalties and averages categories", () => {
    const issues: AuditIssue[] = [
      {
        title: "Missing CSP",
        category: "Security",
        severity: "medium",
        confidence: "high",
        source: "headers",
        evidence: ["missing content-security-policy"],
        businessImpact: "Browser hardening is weaker.",
        recommendation: "Add CSP.",
        requiresAccess: false
      },
      {
        title: "Missing title",
        category: "SEO",
        severity: "medium",
        confidence: "high",
        source: "html",
        evidence: ["missing title"],
        businessImpact: "Search snippets are weaker.",
        recommendation: "Add title.",
        requiresAccess: false
      }
    ];

    const scores = scoreAudit(issues, { status: "skipped" });
    expect(scores.categories.Security).toBe(90);
    expect(scores.categories.SEO).toBe(90);
    expect(scores.overall).toBe(98);
  });
});
