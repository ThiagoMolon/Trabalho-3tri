#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"

cd "$PROJECT_ROOT/frontend"
npm run build
(cd "$PROJECT_ROOT/worker" && npx wrangler deploy)
npx wrangler pages deploy dist --project-name=trabalho-3tri
