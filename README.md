# dimaso-diagnosis-engine

Website diagnosis and rebuild scope MVP for Dimaso. It diagnoses public websites, produces a client-facing report, and gives Dimaso an internal scope brief without requiring admin access.

## Run locally

```bash
git clone <repo-url>
cd dimaso-diagnosis-engine
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/diagnose`. The lower-level technical audit remains available at `http://localhost:3000/audit`.

## Environment variables

- `GOOGLE_PAGESPEED_API_KEY`: optional. If missing, PageSpeed is skipped.
- `OPENAI_API_KEY`: optional. If missing, a rule-based summary is generated.
- `AUDIT_REQUEST_TIMEOUT_MS`: optional request timeout override.
- `AUDIT_MAX_REDIRECTS`: optional redirect limit override.

## What v0.1 includes

- Website diagnosis and rebuild/optimization recommendation.
- Organization and goal-aware feature gap analysis.
- Public crawl and content inventory.
- Information architecture, workflow, migration risk, and scope estimate.
- Client report plus internal Dimaso brief.
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

## Diagnosis API

`POST /api/diagnose`

```json
{
  "url": "https://example.com",
  "organizationType": "service_business",
  "primaryGoal": "leads"
}
```

The response includes deterministic scores, rebuild recommendation, content inventory, feature gaps, roadmap, client report, and internal Dimaso brief.
