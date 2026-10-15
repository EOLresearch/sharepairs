#!/usr/bin/env bash
# Ensure study DynamoDB assessments table exists (assignments + REDCap export status).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"

: "${ASSESSMENTS_TABLE:=sharepairs-dev-assessments}"
: "${API_LAMBDA_NAME:=${API_LAMBDA_NAME:-sharepairs-dev-api}}"

echo "==> Account: $(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo unknown)"
echo "==> Ensuring DynamoDB table: $ASSESSMENTS_TABLE"

if aws dynamodb describe-table --table-name "$ASSESSMENTS_TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "    Table already exists."
else
  echo "    Creating table..."
  aws dynamodb create-table \
    --table-name "$ASSESSMENTS_TABLE" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --region "$AWS_REGION" \
    --tags Key=Name,Value="$ASSESSMENTS_TABLE" Key=Purpose,Value="Assessment assignments and REDCap export status" \
    >/dev/null
  echo "    Waiting for ACTIVE..."
  aws dynamodb wait table-exists --table-name "$ASSESSMENTS_TABLE" --region "$AWS_REGION"
  echo "    Created."
fi

echo "==> Enabling point-in-time recovery..."
aws dynamodb update-continuous-backups \
  --table-name "$ASSESSMENTS_TABLE" \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region "$AWS_REGION" \
  --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
  --output text >/dev/null || echo "    PITR update skipped (may already be enabled)."

echo "==> Setting Lambda ASSESSMENTS_TABLE=$ASSESSMENTS_TABLE (merge into existing env)..."
TMP_ENV="$(mktemp)"
aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables' \
  --output json > "$TMP_ENV"

python3 - "$TMP_ENV" "$ASSESSMENTS_TABLE" <<'PY'
import json, sys
path, table = sys.argv[1], sys.argv[2]
with open(path) as f:
    vars_ = json.load(f) or {}
vars_["ASSESSMENTS_TABLE"] = table
with open(path, "w") as f:
    json.dump({"Variables": vars_}, f)
PY

aws lambda update-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --environment "file://${TMP_ENV}" \
  --query 'Environment.Variables.ASSESSMENTS_TABLE' \
  --output text
rm -f "$TMP_ENV"

aws lambda wait function-updated --function-name "$API_LAMBDA_NAME" --region "$AWS_REGION" 2>/dev/null || true

echo ""
echo "Done. Assessment assignments persist in $ASSESSMENTS_TABLE."
echo "REDCap export stays unconfigured until mapping is confirmed (REDCAP_MAPPING_CONFIRMED)."
