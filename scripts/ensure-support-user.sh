#!/usr/bin/env bash
# Upsert Study Support account in the study DynamoDB table.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"

: "${SUPPORT_EMAIL:=eolstudysupport@med.cornell.edu}"
: "${SUPPORT_UID:=ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1}"
: "${USERS_TABLE:=sharepairs-dev-users}"
# shellcheck source=require-study-secrets.sh
source "$ROOT/scripts/require-study-secrets.sh"

export SUPPORT_EMAIL SUPPORT_PASSWORD SUPPORT_UID STUB_AUTH_SECRET USERS_TABLE
export AWS_REGION

echo "==> Ensuring Study Support user ($SUPPORT_EMAIL)"
cd "$ROOT/backend"
# Prefer already-installed deps from deploy-api-lambda; install lean if missing
if [ ! -d node_modules/@aws-sdk/client-dynamodb ]; then
  export npm_config_cache="${npm_config_cache:-/tmp/npm-cache}"
  npm install --omit=dev --no-fund --no-audit
fi
node scripts/ensure-support-user.js
