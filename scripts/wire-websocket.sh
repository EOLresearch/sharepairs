#!/usr/bin/env bash
# Discover WebSocket API and set WEBSOCKET_API_ENDPOINT on the API Lambda.
# Uses --cli-input-json so other env vars (STUB_AUTH, CORS_ORIGIN, secrets) are preserved.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"
# shellcheck source=require-study-secrets.sh
source "$ROOT/scripts/require-study-secrets.sh"

echo "============================================"
echo " Wire WebSocket endpoint onto API Lambda"
echo "============================================"

if [ -z "${WEBSOCKET_API_ENDPOINT:-}" ] || [ "$WEBSOCKET_API_ENDPOINT" = "None" ]; then
  echo "ERROR: Could not discover WebSocket API (sharepairs-dev-websocket)." >&2
  aws apigatewayv2 get-apis --query "Items[?ProtocolType=='WEBSOCKET'].[Name,ApiId,ApiEndpoint]" --output table >&2 || true
  exit 1
fi

echo "WEBSOCKET_API_ENDPOINT=$WEBSOCKET_API_ENDPOINT"
WSS_URL="${WEBSOCKET_API_ENDPOINT/https:\/\//wss://}"
echo "REACT_APP_WS_URL=$WSS_URL"

EXISTING="$(aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables' \
  --output json)"

PAYLOAD_FILE="$(mktemp /tmp/lambda-env-XXXXXX.json)"
EXISTING_JSON="$EXISTING" WEBSOCKET_API_ENDPOINT="$WEBSOCKET_API_ENDPOINT" \
STUB_AUTH_SECRET="$STUB_AUTH_SECRET" SUPPORT_PASSWORD="$SUPPORT_PASSWORD" \
API_LAMBDA_NAME="$API_LAMBDA_NAME" PAYLOAD_FILE="$PAYLOAD_FILE" python3 - <<'PY'
import json, os
env = json.loads(os.environ.get("EXISTING_JSON") or "null") or {}
if not isinstance(env, dict):
  env = {}
retired_secrets = {"sharepairs-dev-launch", "unset-set-via-wire-api", "dev-secret-change-in-prod"}
defaults = {
  "STUB_AUTH": "true",
  "STAGE": "dev",
  "SIMPATICO_ENV": "study",
  "REQUIRE_EMAIL_VERIFICATION": "false",
  "REQUIRE_INVITE": "true",
  "SUPPORT_UID": "ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1",
  "SUPPORT_EMAIL": "eolstudysupport@med.cornell.edu",
  "USERS_TABLE": "sharepairs-dev-users",
  "CONVERSATIONS_TABLE": "sharepairs-dev-conversations",
  "MESSAGES_TABLE": "sharepairs-dev-messages",
  "CONNECTIONS_TABLE": "sharepairs-dev-connections",
}
for k, v in defaults.items():
  if not env.get(k):
    env[k] = v
secret = os.environ.get("STUB_AUTH_SECRET") or ""
if env.get("STUB_AUTH_SECRET") in retired_secrets or not env.get("STUB_AUTH_SECRET"):
  env["STUB_AUTH_SECRET"] = secret
if env.get("SUPPORT_PASSWORD") in (None, "", "password123"):
  env["SUPPORT_PASSWORD"] = os.environ.get("SUPPORT_PASSWORD") or ""
if not env.get("CORS_ORIGIN") or env.get("CORS_ORIGIN") == "*":
  env["CORS_ORIGIN"] = "https://d63lgf5y8mx7j.cloudfront.net"
env["WEBSOCKET_API_ENDPOINT"] = os.environ["WEBSOCKET_API_ENDPOINT"]
payload = {
  "FunctionName": os.environ["API_LAMBDA_NAME"],
  "Environment": {"Variables": {str(k): str(v) for k, v in env.items() if v is not None}},
}
with open(os.environ["PAYLOAD_FILE"], "w") as f:
  json.dump(payload, f)
PY

aws lambda update-function-configuration \
  --cli-input-json "file://${PAYLOAD_FILE}" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables.[STUB_AUTH,CORS_ORIGIN,WEBSOCKET_API_ENDPOINT,REQUIRE_EMAIL_VERIFICATION]' \
  --output table

rm -f "$PAYLOAD_FILE"
aws lambda wait function-updated --function-name "$API_LAMBDA_NAME" --region "$AWS_REGION"

echo ""
echo "Lambda env (auth-critical):"
aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --query 'Environment.Variables.{STUB_AUTH:STUB_AUTH,CORS:CORS_ORIGIN,WS:WEBSOCKET_API_ENDPOINT,VERIFY:REQUIRE_EMAIL_VERIFICATION,INVITE:REQUIRE_INVITE}' \
  --output table

echo "============================================"
