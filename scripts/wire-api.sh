#!/usr/bin/env bash
# Wire sharepairs-dev-api Lambda to API Gateway ($default route).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$(dirname "$0")/aws-env.sh"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
LAMBDA_ARN="arn:aws:lambda:${AWS_REGION}:${ACCOUNT}:function:${API_LAMBDA_NAME}"
EXEC_ARN="arn:aws:execute-api:${AWS_REGION}:${ACCOUNT}:${API_GATEWAY_ID}"

echo "==> API Gateway: $API_GATEWAY_ID"
echo "==> CloudFront: https://$CLOUDFRONT_DOMAIN"
if [ -z "${WEBSOCKET_API_ENDPOINT:-}" ] || [ "$WEBSOCKET_API_ENDPOINT" = "None" ]; then
  echo "ERROR: WEBSOCKET_API_ENDPOINT is empty — chat push will not work." >&2
  echo "  Run: ./scripts/wire-websocket.sh" >&2
  echo "  Or: aws apigatewayv2 get-apis --query \"Items[?ProtocolType=='WEBSOCKET']\"" >&2
  exit 1
fi
echo "==> WebSocket: $WEBSOCKET_API_ENDPOINT"

EXISTING="$(aws apigatewayv2 get-routes --api-id "$API_GATEWAY_ID" \
  --query "Items[?RouteKey=='\$default'].RouteId" --output text 2>/dev/null || true)"

if [ -n "$EXISTING" ] && [ "$EXISTING" != "None" ]; then
  echo "==> \$default route already exists ($EXISTING)"
else
  echo "==> Creating Lambda integration..."
  INTEGRATION_ID="$(aws apigatewayv2 create-integration \
    --api-id "$API_GATEWAY_ID" \
    --integration-type AWS_PROXY \
    --integration-method POST \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version "2.0" \
    --query IntegrationId --output text)"

  echo "==> Creating \$default route -> $INTEGRATION_ID"
  aws apigatewayv2 create-route \
    --api-id "$API_GATEWAY_ID" \
    --route-key '$default' \
    --target "integrations/$INTEGRATION_ID" >/dev/null
fi

echo "==> Ensuring Lambda invoke permission..."
aws lambda add-permission \
  --function-name "$API_LAMBDA_NAME" \
  --statement-id "AllowExecutionFromAPIGatewayApi" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "${EXEC_ARN}/*/*" 2>/dev/null || true

echo "==> Updating Lambda environment..."
# shellcheck source=require-study-secrets.sh
source "$(dirname "$0")/require-study-secrets.sh"
echo "    SIMPATICO_ENV=study"
echo "    SES_FROM_EMAIL=$SES_FROM_EMAIL"
echo "    SUPPORT_EMAIL=${SUPPORT_EMAIL:-eolstudysupport@med.cornell.edu}"
echo "    REQUIRE_EMAIL_VERIFICATION=false"
echo "    REQUIRE_INVITE=true"

EXISTING_ENV="$(aws lambda get-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables' \
  --output json)"

PAYLOAD_FILE="$(mktemp /tmp/lambda-env-XXXXXX.json)"
EXISTING_JSON="$EXISTING_ENV" \
STUB_AUTH_SECRET="$STUB_AUTH_SECRET" \
SUPPORT_PASSWORD="$SUPPORT_PASSWORD" \
SUPPORT_EMAIL="${SUPPORT_EMAIL:-eolstudysupport@med.cornell.edu}" \
SES_FROM_EMAIL="$SES_FROM_EMAIL" \
CLOUDFRONT_DOMAIN="$CLOUDFRONT_DOMAIN" \
USER_UPLOADS_BUCKET="${USER_UPLOADS_BUCKET:-}" \
WEBSOCKET_API_ENDPOINT="$WEBSOCKET_API_ENDPOINT" \
ADMIN_EMAILS="${ADMIN_EMAILS:-}" \
API_LAMBDA_NAME="$API_LAMBDA_NAME" \
PAYLOAD_FILE="$PAYLOAD_FILE" python3 - <<'PY'
import json, os
env = json.loads(os.environ.get("EXISTING_JSON") or "null") or {}
if not isinstance(env, dict):
  env = {}
env.update({
  "STUB_AUTH": "true",
  "STUB_AUTH_SECRET": os.environ["STUB_AUTH_SECRET"],
  "STAGE": "dev",
  "SIMPATICO_ENV": "study",
  "CORS_ORIGIN": "https://%s" % os.environ["CLOUDFRONT_DOMAIN"],
  "STUDY_APP_URL": "https://%s" % os.environ["CLOUDFRONT_DOMAIN"],
  "USER_UPLOADS_BUCKET": os.environ.get("USER_UPLOADS_BUCKET") or env.get("USER_UPLOADS_BUCKET") or "",
  "WEBSOCKET_API_ENDPOINT": os.environ["WEBSOCKET_API_ENDPOINT"],
  "SUPPORT_UID": "ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1",
  "SUPPORT_EMAIL": os.environ["SUPPORT_EMAIL"],
  "USERS_TABLE": "sharepairs-dev-users",
  "CONVERSATIONS_TABLE": "sharepairs-dev-conversations",
  "MESSAGES_TABLE": "sharepairs-dev-messages",
  "CONNECTIONS_TABLE": "sharepairs-dev-connections",
  "PROMPTS_TABLE": "sharepairs-dev-prompts",
  "DISTRESS_EVENTS_TABLE": "sharepairs-dev-distress-events",
  "ASSESSMENTS_TABLE": "sharepairs-dev-assessments",
  "SUPPORT_PASSWORD": os.environ["SUPPORT_PASSWORD"],
  "SES_FROM_EMAIL": os.environ["SES_FROM_EMAIL"],
  "REQUIRE_EMAIL_VERIFICATION": "false",
  "REQUIRE_INVITE": "true",
})
if os.environ.get("ADMIN_EMAILS"):
  env["ADMIN_EMAILS"] = os.environ["ADMIN_EMAILS"]
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
  --query 'Environment.Variables.[STUB_AUTH,SIMPATICO_ENV,REQUIRE_INVITE,REQUIRE_EMAIL_VERIFICATION,CORS_ORIGIN]' \
  --output table >/dev/null
rm -f "$PAYLOAD_FILE"

echo "==> Updating WebSocket Lambda auth environment..."
WS_EXISTING="$(aws lambda get-function-configuration \
  --function-name "$WEBSOCKET_LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables' \
  --output json)"
WS_PAYLOAD="$(mktemp /tmp/lambda-ws-env-XXXXXX.json)"
EXISTING_JSON="$WS_EXISTING" \
STUB_AUTH_SECRET="$STUB_AUTH_SECRET" \
WEBSOCKET_LAMBDA_NAME="$WEBSOCKET_LAMBDA_NAME" \
CLOUDFRONT_DOMAIN="$CLOUDFRONT_DOMAIN" \
WEBSOCKET_API_ENDPOINT="$WEBSOCKET_API_ENDPOINT" \
PAYLOAD_FILE="$WS_PAYLOAD" python3 - <<'PY'
import json, os
env = json.loads(os.environ.get("EXISTING_JSON") or "null") or {}
if not isinstance(env, dict):
  env = {}
env.update({
  "STUB_AUTH": "true",
  "STUB_AUTH_SECRET": os.environ["STUB_AUTH_SECRET"],
  "SIMPATICO_ENV": "study",
  "USERS_TABLE": env.get("USERS_TABLE") or "sharepairs-dev-users",
  "CONVERSATIONS_TABLE": env.get("CONVERSATIONS_TABLE") or "sharepairs-dev-conversations",
  "MESSAGES_TABLE": env.get("MESSAGES_TABLE") or "sharepairs-dev-messages",
  "CONNECTIONS_TABLE": env.get("CONNECTIONS_TABLE") or "sharepairs-dev-connections",
  "WEBSOCKET_API_ENDPOINT": os.environ.get("WEBSOCKET_API_ENDPOINT") or env.get("WEBSOCKET_API_ENDPOINT") or "",
  "CORS_ORIGIN": "https://%s" % os.environ["CLOUDFRONT_DOMAIN"],
})
payload = {
  "FunctionName": os.environ["WEBSOCKET_LAMBDA_NAME"],
  "Environment": {"Variables": {str(k): str(v) for k, v in env.items() if v is not None}},
}
with open(os.environ["PAYLOAD_FILE"], "w") as f:
  json.dump(payload, f)
PY
aws lambda update-function-configuration \
  --cli-input-json "file://${WS_PAYLOAD}" \
  --region "$AWS_REGION" \
  --query 'Environment.Variables.[STUB_AUTH,SIMPATICO_ENV,CORS_ORIGIN]' \
  --output table >/dev/null
rm -f "$WS_PAYLOAD"
aws lambda wait function-updated --function-name "$WEBSOCKET_LAMBDA_NAME" --region "$AWS_REGION"

echo "==> Waiting for Lambda config update..."
aws lambda wait function-updated --function-name "$API_LAMBDA_NAME"

echo "==> Smoke test (direct API Gateway)..."
STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  "${API_GATEWAY_ENDPOINT}/${API_GATEWAY_STAGE}/api/auth/me" || echo '000')"
echo "    GET /api/auth/me -> HTTP $STATUS (401 expected when logged out)"
