#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"

cd "$PROJECT_ROOT/frontend"
VITE_API_URL="https://trabalho-3tri.origin-beans01.workers.dev" npm run build
(cd "$PROJECT_ROOT/worker" && npx wrangler deploy)
npx wrangler pages deploy dist --project-name=trabalho-3tri
