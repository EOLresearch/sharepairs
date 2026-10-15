#!/usr/bin/env bash
# Set up SES so Share Pairs can send verification emails.
#
# Usage (CloudShell, radiology account):
#   ./scripts/setup-ses-email.sh
#   ./scripts/setup-ses-email.sh jom4013@med.cornell.edu   # also verify a recipient (sandbox)
#
# Defaults SES_FROM_EMAIL=eolstudysupport@med.cornell.edu
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"

FROM="${SES_FROM_EMAIL:-eolstudysupport@med.cornell.edu}"
export SES_FROM_EMAIL="$FROM"

echo "============================================"
echo " Share Pairs — SES email setup"
echo " From: $FROM"
echo " Region: $AWS_REGION"
echo "============================================"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
echo "Account: $ACCOUNT"
if [ "$ACCOUNT" != "$AWS_ACCOUNT_ID" ]; then
  echo "ERROR: Expected account $AWS_ACCOUNT_ID (study stack)." >&2
  exit 1
fi

verify_identity() {
  local email="$1"
  echo ""
  echo "==> Requesting SES verification for: $email"
  aws ses verify-email-identity --email-address "$email" --region "$AWS_REGION"
  echo "    AWS sent a confirmation link to $email — open it and click Verify."
}

echo ""
echo "==> Ensuring FROM identity exists"
STATUS="$(aws ses get-identity-verification-attributes \
  --identities "$FROM" \
  --region "$AWS_REGION" \
  --query "VerificationAttributes.\"${FROM}\".VerificationStatus" \
  --output text 2>/dev/null || echo 'None')"

if [ "$STATUS" = "Success" ]; then
  echo "    $FROM is already verified."
else
  echo "    Current status: $STATUS"
  verify_identity "$FROM"
fi

# Optional extra recipient identities (needed while SES is in sandbox)
for recip in "$@"; do
  [ -n "$recip" ] || continue
  RSTATUS="$(aws ses get-identity-verification-attributes \
    --identities "$recip" \
    --region "$AWS_REGION" \
    --query "VerificationAttributes.\"${recip}\".VerificationStatus" \
    --output text 2>/dev/null || echo 'None')"
  if [ "$RSTATUS" = "Success" ]; then
    echo "    Recipient $recip already verified."
  else
    echo "    Recipient $recip status: $RSTATUS (sandbox requires verified recipients)"
    verify_identity "$recip"
  fi
done

echo ""
echo "==> Checking SES account sending mode"
QUOTA="$(aws ses get-send-quota --region "$AWS_REGION" --output json)"
echo "$QUOTA" | python3 -c "
import json,sys
q=json.load(sys.stdin)
max24=float(q.get('Max24HourSend') or 0)
print(f\"    Max24HourSend={max24}\")
# Sandbox accounts are typically capped at 200/day
if max24 <= 200:
  print('    Likely still in SES SANDBOX.')
  print('    In sandbox you can only send TO verified addresses.')
  print('    Verify each tester email with this script, or request production access:')
  print('      AWS Console → SES → Account dashboard → Request production access')
else:
  print('    Looks like production access (or a raised quota).')
"

echo ""
echo "==> Ensuring Lambda role can call SES (best-effort)"
ROLE_NAME="$(aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Role' --output text | awk -F/ '{print $NF}')"
echo "    Role: $ROLE_NAME"
POLICY_NAME="sharepairs-ses-send"
POLICY_DOC='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"}]}'
if aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY_DOC" 2>/dev/null; then
  echo "    Attached inline policy $POLICY_NAME"
else
  echo "    Could not attach IAM policy (permissions). If SendEmail fails later,"
  echo "    ask ITS to allow ses:SendEmail / ses:SendRawEmail on $ROLE_NAME."
fi

echo ""
echo "==> Setting SES_FROM_EMAIL on $API_LAMBDA_NAME"
# Merge into existing env so we don't wipe other vars
EXISTING="$(aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables' \
  --output json)"
MERGED="$(EXISTING_JSON="$EXISTING" SES_FROM_EMAIL="$FROM" python3 - <<'PY'
import json, os
env = json.loads(os.environ["EXISTING_JSON"] or "{}") or {}
env["SES_FROM_EMAIL"] = os.environ["SES_FROM_EMAIL"]
print(",".join(f"{k}={v}" for k, v in env.items()))
PY
)"
aws lambda update-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --environment "Variables={${MERGED}}" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables.SES_FROM_EMAIL' \
  --output text >/dev/null
aws lambda wait function-updated --function-name "$API_LAMBDA_NAME" --region "$AWS_REGION"
echo "    SES_FROM_EMAIL=$FROM"

echo ""
echo "============================================"
echo " Next steps"
echo " 1. Inbox for $FROM → click AWS Verify link (if not already Success)."
for recip in "$@"; do
  echo " 2. Inbox for $recip → click AWS Verify link (sandbox recipients)."
done
echo " 3. Confirm status:"
echo "      aws ses get-identity-verification-attributes --identities $FROM --region $AWS_REGION"
echo " 4. On the app: Resend code (or register again)."
echo " 5. If still no mail, check CloudWatch:"
echo "      aws logs tail /aws/lambda/$API_LAMBDA_NAME --since 10m --filter-pattern email"
echo "============================================"
