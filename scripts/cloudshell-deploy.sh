#!/usr/bin/env bash
# One-shot deploy for AWS CloudShell (no Terraform required).
#
# Usage:
#   ./scripts/cloudshell-deploy.sh              # wire API + CloudFront + build + publish
#   ./scripts/cloudshell-deploy.sh --skip-build # if you uploaded a pre-built build/ folder
#   ./scripts/cloudshell-deploy.sh --wire-only  # API + CloudFront only, no frontend upload
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_BUILD=false
WIRE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --wire-only) WIRE_ONLY=true ;;
  esac
done

# CloudShell has ~1GB home disk — prefer prebuilt frontend to avoid npm ci.
if [ -d "$ROOT/build" ] && [ "$SKIP_BUILD" = false ] && [ "${FORCE_FRONTEND_BUILD:-}" != "1" ]; then
  echo "Found build/ — skipping frontend npm install (CloudShell disk-safe)."
  echo "Set FORCE_FRONTEND_BUILD=1 to rebuild in CloudShell."
  SKIP_BUILD=true
fi

# Use /tmp for npm cache (home disk is tiny in CloudShell)
export npm_config_cache="${npm_config_cache:-/tmp/npm-cache}"
export TMPDIR="${TMPDIR:-/tmp}"
mkdir -p "$npm_config_cache"

echo "============================================"
echo " Share Pairs — CloudShell deploy"
echo " Region: ${AWS_REGION:-us-east-1}"
echo " Study URL: https://d63lgf5y8mx7j.cloudfront.net/"
echo "============================================"

# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"
# shellcheck source=require-study-secrets.sh
source "$ROOT/scripts/require-study-secrets.sh"

echo ""
echo "Account: $(aws sts get-caller-identity --query Account --output text)"
echo "CloudFront: https://$CLOUDFRONT_DOMAIN"
echo "S3 bucket: $FRONTEND_BUCKET"
echo ""

chmod +x "$ROOT/scripts/"*.sh

echo "==> Step 1/6: Deploy API Lambda (register/login/logout)"
"$ROOT/scripts/deploy-api-lambda.sh"

echo ""
echo "==> Step 2/6: SES sender ($SES_FROM_EMAIL)"
# Verify FROM (+ optional recipients via SES_VERIFY_RECIPIENTS="a@x,b@y")
if [ -n "${SES_VERIFY_RECIPIENTS:-}" ]; then
  IFS=',' read -r -a RECIP_ARGS <<< "$SES_VERIFY_RECIPIENTS"
  "$ROOT/scripts/setup-ses-email.sh" "${RECIP_ARGS[@]}"
else
  "$ROOT/scripts/setup-ses-email.sh"
fi

echo ""
echo "==> Step 3/6: Wire API Gateway -> Lambda"
"$ROOT/scripts/wire-api.sh"

echo ""
echo "==> Step 3b/6: Ensure WebSocket endpoint on API Lambda"
"$ROOT/scripts/wire-websocket.sh"

echo ""
echo "==> Step 3c/6: Ensure prompts DynamoDB table"
"$ROOT/scripts/ensure-prompts-table.sh"

echo ""
echo "==> Step 3d/6: Ensure assessments DynamoDB table"
"$ROOT/scripts/ensure-assessments-table.sh"

echo ""
echo "==> Step 4/6: Ensure Study Support login ($SUPPORT_EMAIL)"
export SUPPORT_EMAIL SUPPORT_PASSWORD
"$ROOT/scripts/ensure-support-user.sh"

echo ""
echo "==> Step 5/6: Wire CloudFront /api/* -> API Gateway"
"$ROOT/scripts/wire-cloudfront-api.sh"

if [ "$WIRE_ONLY" = true ]; then
  echo ""
  echo "Wire-only complete. After CloudFront deploys (~5–15 min), test:"
  echo "  curl -i https://$CLOUDFRONT_DOMAIN/api/auth/me"
  exit 0
fi

echo ""
echo "==> Step 6/6: Build + publish frontend"
if [ "$SKIP_BUILD" = true ]; then
  "$ROOT/scripts/deploy-frontend.sh" --skip-build
else
  "$ROOT/scripts/deploy-frontend.sh"
fi

echo ""
echo "============================================"
echo " All steps submitted."
echo " App URL: https://$CLOUDFRONT_DOMAIN"
echo " Verification From: $SES_FROM_EMAIL"
echo " Study Support login: $SUPPORT_EMAIL (password from SUPPORT_PASSWORD)"
echo ""
echo " Confirm SES FROM is Verified (check that inbox for AWS link)."
echo " While SES is in sandbox, also verify each tester's email."
echo "============================================"
