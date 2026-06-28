# Dimaso Audit Tool Agent Instructions

This repository is the first MVP of Dimaso's external website audit tool.

## Project rules

- Keep v0.1 database-free, auth-free, dashboard-free, and payment-free.
- The app must run from a fresh clone with `npm install`, `.env.local` copied from `.env.example`, and `npm run dev`.
- Do not commit real secrets. Add new required variables to `.env.example`.
- Treat GitHub as the source of truth. Keep docs and setup steps reproducible.
- The audit must work from public website access only. Never claim private CMS/admin facts without verified access.
- Every finding must include evidence, business impact, recommendation, confidence, source, and whether access is required.

## Security expectations

- Validate and normalize user URLs before fetches.
- Only allow `http:` and `https:`.
- Block localhost, loopback, private, link-local, multicast, and internal IP ranges.
- Resolve hostnames before requests and re-check each redirect target.
- Use request timeouts and a bounded redirect count.
- Do not execute user-submitted code.
- Do not expose API keys to the frontend.
- Do not submit forms during static form audits.
- Do not claim analytics, conversion, or schema coverage beyond public HTML/script evidence.

## Product wording

Use cautious language for public fingerprints:

- "Detected public plugin trace"
- "Possible exposed plugin version"
- "Possibly outdated based on public fingerprint"
- "Requires WordPress admin access for confirmation"

Avoid unverified claims such as "definitely outdated", "has X outdated plugins", or "installation is insecure".

AI summaries may explain and prioritize only structured facts already returned by the audit engine. AI must never create numeric scores or new findings.
