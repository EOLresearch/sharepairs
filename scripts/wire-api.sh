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
aws lambda update-function-configuration \
  --function-name "$API_LAMBDA_NAME" \
  --environment "Variables={STUB_AUTH=true,STAGE=dev,CORS_ORIGIN=https://${CLOUDFRONT_DOMAIN},USER_UPLOADS_BUCKET=sharepairs-dev-user-uploads,SUPPORT_UID=ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1,USERS_TABLE=sharepairs-dev-users,CONVERSATIONS_TABLE=sharepairs-dev-conversations,MESSAGES_TABLE=sharepairs-dev-messages}" \
  --query 'Environment.Variables' \
  --output json >/dev/null

echo "==> Waiting for Lambda config update..."
aws lambda wait function-updated --function-name "$API_LAMBDA_NAME"

echo "==> Smoke test (direct API Gateway)..."
STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  "${API_GATEWAY_ENDPOINT}/${API_GATEWAY_STAGE}/api/auth/me" || echo '000')"
echo "    GET /api/auth/me -> HTTP $STATUS (401 expected when logged out)"
