# dimaso-audit-tool

External website audit MVP for Dimaso. It audits public URLs without admin access.

## Run locally

```bash
git clone <repo-url>
cd dimaso-audit-tool
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/audit`.

## Environment variables

- `GOOGLE_PAGESPEED_API_KEY`: optional. If missing, PageSpeed is skipped.
- `OPENAI_API_KEY`: optional. If missing, a rule-based summary is generated.
- `AUDIT_REQUEST_TIMEOUT_MS`: optional request timeout override.
- `AUDIT_MAX_REDIRECTS`: optional redirect limit override.
- `AUDIT_MAX_PAGES`: optional maximum number of same-domain pages to audit per run. Defaults to 50.
- `AUDIT_MAX_LINK_CHECKS`: optional maximum number of discovered links to check for broken responses. Defaults to 500.

## What v0.1 includes

- Domain-wide public website checks from the start URL, sitemap.xml, and same-domain internal links.
- Per-page form checks for missing actions, submit controls, field names, and accessible field labels.
- Broken link checks across discovered links, with source pages included in findings.
- Security header checks.
- Platform detection with public fingerprints.
- WordPress public fingerprint module when WordPress is likely.
- Optional PageSpeed Insights integration.
- Optional AI summary constrained to structured audit facts.
- Deterministic scoring.

## What v0.1 intentionally excludes

Database, auth, dashboard, PDF export, CRM, payment, and any admin-only CMS checks.
