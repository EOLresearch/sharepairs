#!/usr/bin/env bash
# Build the React app and publish to S3 + CloudFront.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$(dirname "$0")/aws-env.sh"

cd "$ROOT"

SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
  esac
done

echo "==> Target bucket: s3://$FRONTEND_BUCKET"
echo "==> CloudFront: https://$CLOUDFRONT_DOMAIN"

if [ "$SKIP_BUILD" = false ]; then
  echo "==> Installing dependencies..."
  npm ci
  echo "==> Building React app..."
  # CRA loads .env.local even for production builds. Shell exports win over the file —
  # force blank API URL so study ships same-origin /api (never localhost).
  if [ -n "${WEBSOCKET_API_ENDPOINT:-}" ]; then
    export REACT_APP_WS_URL="${WEBSOCKET_API_ENDPOINT/https:\/\//wss://}"
    echo "    REACT_APP_WS_URL=$REACT_APP_WS_URL"
  else
    export REACT_APP_WS_URL=""
    echo "    REACT_APP_WS_URL=(runtime /api/realtime/config)"
  fi
  # Prefer same-origin /api via CloudFront (no REACT_APP_API_URL) so cookies/Bearer
  # work without CORS. Set USE_DIRECT_API=1 to bake in API Gateway URL instead.
  if [ "${USE_DIRECT_API:-}" = "1" ] && [ -n "${API_GATEWAY_ENDPOINT:-}" ]; then
    export REACT_APP_API_URL="${API_GATEWAY_ENDPOINT%/}/${API_GATEWAY_STAGE}"
    echo "    REACT_APP_API_URL=$REACT_APP_API_URL"
  else
    export REACT_APP_API_URL=""
    echo "    REACT_APP_API_URL=(same-origin /api via CloudFront)"
  fi
  if grep -q 'localhost' <<<"${REACT_APP_API_URL}${REACT_APP_WS_URL}" 2>/dev/null; then
    echo "ERROR: Refusing to build study frontend with localhost in REACT_APP_*" >&2
    exit 1
  fi
  # CloudShell sets CI=true, which makes CRA treat ESLint warnings as errors.
  CI=false npm run build
  # Fail if the bundle still calls the local API (baked .env.local). The string
  # http://localhost:3001 may appear once as a runtime local-only fallback — that is OK.
  if rg -q 'http://localhost:3001/api|ws://localhost:3001' build/static/js/*.js 2>/dev/null; then
    echo "ERROR: build still targets localhost API/WS — check .env.local override" >&2
    exit 1
  fi
else
  echo "==> Skipping build (using existing build/ directory)"
  [ -d build ] || { echo "No build/ directory. Run without --skip-build."; exit 1; }
fi

echo "==> Syncing to S3..."
aws s3 sync build/ "s3://$FRONTEND_BUCKET" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "asset-manifest.json"

aws s3 cp build/index.html "s3://$FRONTEND_BUCKET/index.html" \
  --cache-control "public,max-age=0,must-revalidate" \
  --content-type "text/html"

if [ -f build/asset-manifest.json ]; then
  aws s3 cp build/asset-manifest.json "s3://$FRONTEND_BUCKET/asset-manifest.json" \
    --cache-control "public,max-age=0,must-revalidate" \
    --content-type "application/json"
fi

echo "==> Invalidating CloudFront cache..."
INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)"

echo "    Invalidation: $INVALIDATION_ID"
echo ""
echo "Done! App URL: https://$CLOUDFRONT_DOMAIN"
