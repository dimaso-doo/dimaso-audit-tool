import type { AuditIssue, IssueCategory, PageSpeedScores, ScoreBreakdown } from "./types";

const categories: IssueCategory[] = [
  "Performance",
  "SEO",
  "Accessibility",
  "Security",
  "Technical health",
  "Platform risk"
];

const penalty = {
  critical: 30,
  high: 18,
  medium: 10,
  low: 5,
  info: 0
} as const;

export function scoreAudit(issues: AuditIssue[], pageSpeed: PageSpeedScores): ScoreBreakdown {
  const scores = Object.fromEntries(categories.map((category) => [category, 100])) as Record<IssueCategory, number>;

  for (const issue of issues) {
    scores[issue.category] = Math.max(0, scores[issue.category] - penalty[issue.severity]);
  }

  const perfScores = [pageSpeed.mobile?.performance, pageSpeed.desktop?.performance].filter(
    (score): score is number => typeof score === "number"
  );

  if (perfScores.length) {
    scores.Performance = Math.round(perfScores.reduce((sum, score) => sum + score, 0) / perfScores.length);
  }

  const overall = Math.round(categories.reduce((sum, category) => sum + scores[category], 0) / categories.length);
  return { overall, categories: scores };
}
