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

## What v0.1 includes

- Universal public website checks.
- Security header checks.
- Platform detection with public fingerprints.
- WordPress public fingerprint module when WordPress is likely.
- Tracking, schema, conversion, and static form audits.
- Optional PageSpeed Insights integration.
- Optional AI summary constrained to structured audit facts.
- Deterministic scoring.
- Browser-generated PDF report links after an audit result is available.

## What v0.1 intentionally excludes

Database, auth, dashboard, CRM, payment, and any admin-only CMS checks.

## Reports

Run an audit, then click `Generate PDF`. The app creates visible `Open PDF` and `Download PDF` links for the current browser session.
