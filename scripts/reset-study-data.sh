#!/usr/bin/env bash
# Wipe study DynamoDB activity before volunteer handoff (keeps Support + prompts).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=aws-env.sh
source "$ROOT/scripts/aws-env.sh"

: "${SUPPORT_EMAIL:=eolstudysupport@med.cornell.edu}"
: "${SUPPORT_UID:=ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1}"
: "${USERS_TABLE:=sharepairs-dev-users}"
: "${KEEP_EMAILS:=$SUPPORT_EMAIL}"
# shellcheck source=require-study-secrets.sh
source "$ROOT/scripts/require-study-secrets.sh"

export SUPPORT_EMAIL SUPPORT_PASSWORD SUPPORT_UID STUB_AUTH_SECRET USERS_TABLE KEEP_EMAILS
export AWS_REGION
export CONFIRM="${CONFIRM:-}"
export DRY_RUN="${DRY_RUN:-}"

cd "$ROOT/backend"
if [ ! -d node_modules/@aws-sdk/client-dynamodb ]; then
  export npm_config_cache="${npm_config_cache:-/tmp/npm-cache}"
  npm install --omit=dev --no-fund --no-audit
fi

echo "==> Study data reset (KEEP_EMAILS=$KEEP_EMAILS)"
node scripts/reset-study-data.js
