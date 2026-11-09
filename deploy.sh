#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
VITE_API_URL="${VITE_API_URL:-https://trabalho-3tri.onrender.com}"

cd "$PROJECT_ROOT/frontend"
VITE_API_URL="$VITE_API_URL" npm run build
npx wrangler pages deploy dist --project-name=trabalho-3tri
 