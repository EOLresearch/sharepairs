#!/usr/bin/env bash
# Ensure study DynamoDB prompts table exists (fixes chat prompts when the
# table was never created in the radiology account).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"

: "${PROMPTS_TABLE:=sharepairs-dev-prompts}"
: "${API_LAMBDA_NAME:=${API_LAMBDA_NAME:-sharepairs-dev-api}}"

echo "==> Account: $(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo unknown)"
echo "==> Ensuring DynamoDB table: $PROMPTS_TABLE"

if aws dynamodb describe-table --table-name "$PROMPTS_TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "    Table already exists."
else
  echo "    Creating table..."
  aws dynamodb create-table \
    --table-name "$PROMPTS_TABLE" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --region "$AWS_REGION" \
    --tags Key=Name,Value="$PROMPTS_TABLE" Key=Purpose,Value="Admin-editable chat prompt bank" \
    >/dev/null
  echo "    Waiting for ACTIVE..."
  aws dynamodb wait table-exists --table-name "$PROMPTS_TABLE" --region "$AWS_REGION"
  echo "    Created."
fi

echo "==> Setting Lambda PROMPTS_TABLE=$PROMPTS_TABLE (merge into existing env)..."
TMP_ENV="$(mktemp)"
aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables' \
  --output json > "$TMP_ENV"

python3 - "$TMP_ENV" "$PROMPTS_TABLE" <<'PY'
import json, sys
path, table = sys.argv[1], sys.argv[2]
with open(path) as f:
    vars_ = json.load(f) or {}
vars_["PROMPTS_TABLE"] = table
with open(path, "w") as f:
    json.dump({"Variables": vars_}, f)
PY

aws lambda update-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --environment "file://${TMP_ENV}" \
  --query 'Environment.Variables.PROMPTS_TABLE' \
  --output text
rm -f "$TMP_ENV"

aws lambda wait function-updated --function-name "$API_LAMBDA_NAME" --region "$AWS_REGION" 2>/dev/null || true

echo ""
echo "Done. In the app: open a conversation → right panel → Prompts."
echo "First load auto-seeds the default prompt bank into the new table."
