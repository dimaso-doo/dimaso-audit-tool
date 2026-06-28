#!/usr/bin/env bash
set -euo pipefail

docker compose -f docker-compose.cognee.yml up -d
echo "Cognee compose stack started."
