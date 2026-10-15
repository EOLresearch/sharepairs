#!/usr/bin/env bash
# Diagnose why Share Pairs verification emails aren't arriving.
# Run in radiology CloudShell (account 562395967936).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh" 2>/dev/null || true

: "${AWS_REGION:=us-east-1}"
: "${API_LAMBDA_NAME:=sharepairs-dev-api}"
: "${SES_FROM_EMAIL:=eolstudysupport@med.cornell.edu}"
TO="${1:-jom4013@med.cornell.edu}"

echo "============================================"
echo " SES / verification email diagnosis"
echo "============================================"
echo "Account: $(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '?')"
echo "Lambda:  $API_LAMBDA_NAME"
echo "From:    $SES_FROM_EMAIL"
echo "To:      $TO"
echo ""

echo "==> 1) Lambda SES_FROM_EMAIL"
aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables.SES_FROM_EMAIL' \
  --output text || echo "(could not read)"

echo ""
echo "==> 2) SES identity verification"
aws ses get-identity-verification-attributes \
  --identities "$SES_FROM_EMAIL" "$TO" \
  --region "$AWS_REGION" \
  --output table

echo ""
echo "==> 3) SES send quota / sandbox hint"
aws ses get-send-quota --region "$AWS_REGION" --output table

echo ""
echo "==> 4) Recent email-related Lambda logs (15m)"
aws logs tail "/aws/lambda/$API_LAMBDA_NAME" --since 15m --filter-pattern 'email' || true

echo ""
echo "==> 5) Latest verification code log lines (if SES unset)"
aws logs tail "/aws/lambda/$API_LAMBDA_NAME" --since 60m --filter-pattern 'email:log' || true

echo ""
echo "============================================"
echo " How to read this"
echo " - If SES_FROM_EMAIL is None/empty → emails are NOT sent (only logged)."
echo " - If FROM or TO VerificationStatus != Success → click AWS verify links."
echo " - If Max24HourSend is 200 → sandbox; TO must be verified."
echo " - Look for [email:ses] FAILED ... in logs for the real error."
echo "============================================"
