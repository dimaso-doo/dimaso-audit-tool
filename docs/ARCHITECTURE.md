# Dimaso Diagnosis Engine Architecture

The app is a database-free Next.js MVP with two public products:

- `/diagnose` and `POST /api/diagnose` for client diagnosis, rebuild recommendation, scope, roadmap, and internal Dimaso brief.
- `/audit` and `POST /api/audit` for the underlying external technical audit.

`/api/diagnose` safely validates the URL, crawls a bounded set of public pages, runs the audit engine, builds a content inventory, analyzes information architecture, workflow gaps, feature gaps, migration risk, and deterministic scores. Optional APIs are skipped gracefully.

The engine never submits forms, never requires admin access, and marks access-gated claims as assumptions.
