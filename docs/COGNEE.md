# Cognee

Cognee is optional for v0.1. The diagnosis engine and audit tool run without Cognee.

Use Cognee for project memory, diagnosis playbooks, audit rules, decisions, and historical scoping context. Do not upload live API keys or private client secrets.

## Local env

```bash
export COGNEE_BASE_URL="https://tenant-7f49fab2-d0e5-42a9-8304-bf72dbf88a5b.aws.cognee.ai"
export COGNEE_SERVICE_URL="$COGNEE_BASE_URL"
export COGNEE_API_KEY="replace-with-local-secret"
```

## Codex plugin setup

```bash
codex features enable hooks
codex plugin marketplace add topoteretes/cognee-integrations --ref main
codex plugin add cognee@cognee
```

## Local Docker helper

`docker-compose.cognee.yml` is provided as a starting point for local Cognee experiments. It is not required for the diagnosis app.
