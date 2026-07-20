#!/usr/bin/env bash
# Shared AWS resource IDs for deploy scripts.
# Defaults: us-east-1, account discovered at runtime via AWS CLI.
#
# Override before running, e.g.:
#   export AWS_REGION=us-east-1
#   export FRONTEND_BUCKET=my-bucket

: "${AWS_REGION:=us-east-1}"
: "${AWS_ACCOUNT_ID:=562395967936}"
: "${PROJECT_PREFIX:=sharepairs-dev}"

export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"

# Prefer terraform outputs only when state matches the current account.
_tf() {
  local name="$1"
  local infra
  infra="$(cd "$(dirname "${BASH_SOURCE[0]}")/../infra" && pwd)"
  if ! command -v terraform >/dev/null 2>&1 || [ ! -f "$infra/terraform.tfstate" ]; then
    return 0
  fi
  local state_account
  state_account="$(python3 -c "
import json
try:
  with open('$infra/terraform.tfstate') as f:
    for r in json.load(f).get('resources', []):
      if r.get('type') == 'aws_caller_identity' and r.get('instances'):
        print(r['instances'][0]['attributes'].get('account_id', ''))
        break
except Exception:
  pass
" 2>/dev/null || true)"
  local current_account
  current_account="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [ -n "$state_account" ] && [ -n "$current_account" ] && [ "$state_account" = "$current_account" ]; then
    terraform -chdir="$infra" output -raw "$name" 2>/dev/null || true
  fi
}

_discover_api() {
  aws apigatewayv2 get-apis \
    --region "$AWS_REGION" \
    --query "Items[?Name=='${PROJECT_PREFIX}-api'].ApiId | [0]" \
    --output text 2>/dev/null | sed '/^None$/d'
}

_discover_bucket() {
  aws s3api list-buckets \
    --query "Buckets[?contains(Name, '${PROJECT_PREFIX}') && contains(Name, '-frontend')].Name | [0]" \
    --output text 2>/dev/null | sed '/^None$/d'
}

_discover_cloudfront() {
  # Bucket is account-prefixed: sharepairs-dev-<account>-frontend
  # so do not require the literal substring "sharepairs-dev-frontend".
  aws cloudfront list-distributions \
    --output json 2>/dev/null | python3 -c "
import json, sys
prefix = '${PROJECT_PREFIX}'
try:
  data = json.load(sys.stdin)
  items = (data.get('DistributionList') or {}).get('Items') or []
  for d in items:
    origins = ((d.get('Origins') or {}).get('Items')) or []
    origin_hit = any(
      prefix in (o.get('DomainName') or '') and 'frontend' in (o.get('DomainName') or '')
      for o in origins
    )
    comment = (d.get('Comment') or '').lower()
    comment_hit = 'share' in comment or 'sharepairs' in comment
    if origin_hit or comment_hit:
      print(d['Id'])
      print(d['DomainName'])
      break
except Exception:
  pass
" 2>/dev/null
}

_discover_lambda() {
  aws lambda get-function \
    --function-name "${PROJECT_PREFIX}-api" \
    --region "$AWS_REGION" \
    --query 'Configuration.FunctionName' \
    --output text 2>/dev/null | sed '/^None$/d'
}

_verify_account() {
  local current
  current="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [ -z "$current" ]; then
    echo "ERROR: Cannot call AWS STS. Check credentials and region ($AWS_REGION)." >&2
    exit 1
  fi
  if [ "$current" != "$AWS_ACCOUNT_ID" ]; then
    echo "WARNING: Active account is $current (expected $AWS_ACCOUNT_ID)." >&2
    echo "         Continuing with account $current. Set AWS_ACCOUNT_ID to override." >&2
    AWS_ACCOUNT_ID="$current"
  fi
}

_verify_account

: "${API_LAMBDA_NAME:=$(_discover_lambda)}"
: "${API_LAMBDA_NAME:=${PROJECT_PREFIX}-api}"

: "${API_GATEWAY_ID:=$(_tf api_gateway_id)}"
if [ -z "$API_GATEWAY_ID" ]; then API_GATEWAY_ID="$(_discover_api)"; fi

: "${FRONTEND_BUCKET:=$(_tf frontend_bucket_name)}"
if [ -z "$FRONTEND_BUCKET" ]; then FRONTEND_BUCKET="$(_discover_bucket)"; fi
: "${FRONTEND_BUCKET:=${PROJECT_PREFIX}-${AWS_ACCOUNT_ID}-frontend}"

: "${CLOUDFRONT_DISTRIBUTION_ID:=$(_tf cloudfront_distribution_id)}"
: "${CLOUDFRONT_DOMAIN:=$(_tf cloudfront_domain_name)}"
if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ] || [ -z "$CLOUDFRONT_DOMAIN" ]; then
  _cf="$(_discover_cloudfront)"
  if [ -n "$_cf" ]; then
    CLOUDFRONT_DISTRIBUTION_ID="$(echo "$_cf" | sed -n '1p')"
    CLOUDFRONT_DOMAIN="$(echo "$_cf" | sed -n '2p')"
  fi
fi

if [ -n "$API_GATEWAY_ID" ] && [ "$API_GATEWAY_ID" != "None" ]; then
  : "${API_GATEWAY_ENDPOINT:=https://${API_GATEWAY_ID}.execute-api.${AWS_REGION}.amazonaws.com}"
else
  : "${API_GATEWAY_ENDPOINT:=$(_tf api_gateway_endpoint)}"
fi

: "${USER_UPLOADS_BUCKET:=$(_tf user_uploads_bucket_name)}"
: "${USER_UPLOADS_BUCKET:=${PROJECT_PREFIX}-${AWS_ACCOUNT_ID}-user-uploads}"

: "${WEBSOCKET_API_ENDPOINT:=$(_tf websocket_api_endpoint)}"

: "${API_GATEWAY_STAGE:=prod}"

export API_GATEWAY_ID API_GATEWAY_ENDPOINT
export CLOUDFRONT_DISTRIBUTION_ID CLOUDFRONT_DOMAIN FRONTEND_BUCKET
export API_LAMBDA_NAME API_GATEWAY_STAGE AWS_ACCOUNT_ID PROJECT_PREFIX
export USER_UPLOADS_BUCKET WEBSOCKET_API_ENDPOINT

# Fail fast with a helpful message if core resources are missing.
_missing=()
[ -z "$API_GATEWAY_ID" ] || [ "$API_GATEWAY_ID" = "None" ] && _missing+=("API Gateway '${PROJECT_PREFIX}-api'")
[ -z "$CLOUDFRONT_DISTRIBUTION_ID" ] || [ "$CLOUDFRONT_DISTRIBUTION_ID" = "None" ] && _missing+=("CloudFront distribution for '${PROJECT_PREFIX}-frontend'")
aws s3api head-bucket --bucket "$FRONTEND_BUCKET" >/dev/null 2>&1 || _missing+=("S3 bucket '$FRONTEND_BUCKET'")
aws lambda get-function --function-name "$API_LAMBDA_NAME" --region "$AWS_REGION" >/dev/null 2>&1 || _missing+=("Lambda '$API_LAMBDA_NAME'")

if [ "${#_missing[@]}" -gt 0 ]; then
  echo "ERROR: Missing AWS resources in $AWS_REGION (account $AWS_ACCOUNT_ID):" >&2
  for m in "${_missing[@]}"; do echo "  - $m" >&2; done
  echo "" >&2
  echo "Run 'terraform apply' in infra/ first, or export the missing IDs manually." >&2
  echo "Run './scripts/discover-aws.sh' to inspect what exists." >&2
  exit 1
fi
