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
  npm run build
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
