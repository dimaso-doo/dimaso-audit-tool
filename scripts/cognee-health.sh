#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${COGNEE_BASE_URL:-http://localhost:8000}"
curl -fsS "$BASE_URL/docs" >/dev/null
echo "Cognee reachable at $BASE_URL"
