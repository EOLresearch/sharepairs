#!/usr/bin/env bash
# Send a real SES test email (and print diagnosis).
# Run in radiology CloudShell (account 562395967936).
#
# Usage:
#   ./scripts/test-ses-email.sh
#   ./scripts/test-ses-email.sh your@email.edu
#   TO=a@x.edu FROM=eolstudysupport@med.cornell.edu ./scripts/test-ses-email.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh" 2>/dev/null || true

: "${AWS_REGION:=us-east-1}"
: "${API_LAMBDA_NAME:=sharepairs-dev-api}"
: "${FROM:=${SES_FROM_EMAIL:-eolstudysupport@med.cornell.edu}}"
TO="${1:-${TO:-jom4013@med.cornell.edu}}"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '?')"
echo "============================================"
echo " SES test send"
echo "============================================"
echo "Account: $ACCOUNT"
echo "Region:  $AWS_REGION"
echo "From:    $FROM"
echo "To:      $TO"
echo ""

if [[ "$ACCOUNT" != "562395967936" ]]; then
  echo "WARNING: expected study account 562395967936, got $ACCOUNT"
  echo "         Use radiology CloudShell, not the Mac CLI."
  echo ""
fi

echo "==> Lambda SES_FROM_EMAIL"
LAMBDA_FROM="$(aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables.SES_FROM_EMAIL' \
  --output text 2>/dev/null || echo '(unavailable)')"
echo "    $LAMBDA_FROM"
if [[ -z "$LAMBDA_FROM" || "$LAMBDA_FROM" == "None" || "$LAMBDA_FROM" == "(unavailable)" ]]; then
  echo "    FAIL: API Lambda has no SES_FROM_EMAIL — app emails will only log."
  echo "    Fix: ./scripts/setup-ses-email.sh"
fi

echo ""
echo "==> Identity verification (FROM + TO)"
aws ses get-identity-verification-attributes \
  --identities "$FROM" "$TO" \
  --region "$AWS_REGION" \
  --output table

echo ""
echo "==> Send quota"
aws ses get-send-quota --region "$AWS_REGION" --output table

SUBJECT="Share Pairs SES test $(date -u +%Y-%m-%dT%H:%MZ)"
BODY="This is a Share Pairs SES connectivity test.

From: $FROM
To: $TO
Account: $ACCOUNT
Time (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)

If you received this, SES send works from this account/region.
Match and verification emails use the same path when SES_FROM_EMAIL is set on $API_LAMBDA_NAME."

echo ""
echo "==> Sending test email..."
MSG_ID="$(aws ses send-email \
  --region "$AWS_REGION" \
  --from "$FROM" \
  --destination "ToAddresses=$TO" \
  --message "Subject={Data=$SUBJECT,Charset=UTF-8},Body={Text={Data=$BODY,Charset=UTF-8}}" \
  --query 'MessageId' \
  --output text)"

echo "    OK — MessageId: $MSG_ID"
echo "    Check inbox (and spam) for: $TO"
echo "    Subject: $SUBJECT"
echo ""
echo "==> Recent Lambda email logs (last 30m)"
aws logs tail "/aws/lambda/$API_LAMBDA_NAME" --since 30m --filter-pattern 'email' 2>/dev/null || true
echo ""
echo "Done. Inbox delivery = SES works. For match emails, rematch two users in Admin and look for [email:ses] Sent in logs."
