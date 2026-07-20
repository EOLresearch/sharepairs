#!/usr/bin/env bash
# Package and update sharepairs-dev-api Lambda (auth/messages/etc).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$(dirname "$0")/aws-env.sh"

BACKEND="$ROOT/backend"
ZIP="/tmp/sharepairs-api.zip"

echo "==> Installing backend deps"
cd "$BACKEND"
npm install --omit=dev --no-fund --no-audit

echo "==> Building $ZIP"
rm -f "$ZIP"
# Keep package lean: only the API handler tree + shared + production deps
zip -rq "$ZIP" \
  functions/api \
  shared \
  package.json \
  node_modules \
  -x "node_modules/.cache/*" \
  -x "*/.DS_Store"

SIZE_MB="$(du -m "$ZIP" | awk '{print $1}')"
echo "    Zip size: ${SIZE_MB} MB"
if [ "$SIZE_MB" -gt 50 ]; then
  echo "ERROR: Zip exceeds 50 MB direct-upload limit. Upload via S3 instead." >&2
  exit 1
fi

echo "==> Updating Lambda $API_LAMBDA_NAME"
aws lambda update-function-code \
  --function-name "$API_LAMBDA_NAME" \
  --zip-file "fileb://$ZIP" \
  --region "$AWS_REGION" \
  --query '{Function:FunctionName,LastModified:LastModified,CodeSize:CodeSize}' \
  --output json

echo "==> Waiting for update..."
aws lambda wait function-updated --function-name "$API_LAMBDA_NAME" --region "$AWS_REGION"

echo "==> Smoke test"
STATUS="$(curl -s -o /tmp/api-login.json -w '%{http_code}' \
  -X POST "${API_GATEWAY_ENDPOINT}/${API_GATEWAY_STAGE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"password123"}' || echo '000')"
echo "    POST /api/auth/login -> HTTP $STATUS"
head -c 300 /tmp/api-login.json; echo
