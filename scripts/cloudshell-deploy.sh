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

echo "============================================"
echo " Share Pairs — CloudShell deploy"
echo " Region: ${AWS_REGION:-us-east-2}"
echo "============================================"

# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"

echo ""
echo "Account: $(aws sts get-caller-identity --query Account --output text)"
echo "CloudFront: https://$CLOUDFRONT_DOMAIN"
echo "S3 bucket: $FRONTEND_BUCKET"
echo ""

chmod +x "$ROOT/scripts/"*.sh

echo "==> Step 1/3: Wire API Gateway -> Lambda"
"$ROOT/scripts/wire-api.sh"

echo ""
echo "==> Step 2/3: Wire CloudFront /api/* -> API Gateway"
"$ROOT/scripts/wire-cloudfront-api.sh"

if [ "$WIRE_ONLY" = true ]; then
  echo ""
  echo "Wire-only complete. After CloudFront deploys (~5–15 min), test:"
  echo "  curl -i https://$CLOUDFRONT_DOMAIN/api/auth/me"
  exit 0
fi

echo ""
echo "==> Step 3/3: Build + publish frontend"
if [ "$SKIP_BUILD" = true ]; then
  "$ROOT/scripts/deploy-frontend.sh" --skip-build
else
  "$ROOT/scripts/deploy-frontend.sh"
fi

echo ""
echo "============================================"
echo " All steps submitted."
echo " App URL: https://$CLOUDFRONT_DOMAIN"
echo ""
echo " CloudFront /api/* behavior may take a few"
echo " minutes to propagate. Then test login/register."
echo "============================================"
