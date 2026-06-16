#!/usr/bin/env bash
# Add /api/* CloudFront behavior proxying to API Gateway (same-origin cookies).
set -euo pipefail

# shellcheck source=aws-env.sh
source "$(dirname "$0")/aws-env.sh"

API_HOST="${API_GATEWAY_ENDPOINT#https://}"
ORIGIN_ID="API-sharepairs-dev"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

aws cloudfront get-distribution-config --id "$CLOUDFRONT_DISTRIBUTION_ID" > "$TMP/full.json"
ETAG="$(python3 -c "import json; print(json.load(open('$TMP/full.json'))['ETag'])")"
python3 -c "import json; json.dump(json.load(open('$TMP/full.json'))['DistributionConfig'], open('$TMP/config.json','w'), indent=2)"

python3 <<PY
import json

path = "$TMP/config.json"
with open(path) as f:
    cfg = json.load(f)

origins = cfg.setdefault("Origins", {"Quantity": 0, "Items": []})
items = origins.setdefault("Items", [])

if not any(o.get("Id") == "$ORIGIN_ID" for o in items):
    items.append({
        "Id": "$ORIGIN_ID",
        "DomainName": "$API_HOST",
        "OriginPath": "/$API_GATEWAY_STAGE",
        "CustomHeaders": {"Quantity": 0},
        "CustomOriginConfig": {
            "HTTPPort": 80,
            "HTTPSPort": 443,
            "OriginProtocolPolicy": "https-only",
            "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
            "OriginReadTimeout": 30,
            "OriginKeepaliveTimeout": 5,
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": {"Enabled": False},
    })
origins["Quantity"] = len(items)

behaviors = cfg.setdefault("CacheBehaviors", {"Quantity": 0, "Items": []})
bitems = behaviors.setdefault("Items", [])

if not any(b.get("PathPattern") == "/api/*" for b in bitems):
    bitems.insert(0, {
        "PathPattern": "/api/*",
        "TargetOriginId": "$ORIGIN_ID",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 7,
            "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
            "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
        },
        "Compress": False,
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492afa07d3",
        "TrustedSigners": {"Enabled": False, "Quantity": 0},
        "TrustedKeyGroups": {"Enabled": False, "Quantity": 0},
        "SmoothStreaming": False,
        "LambdaFunctionAssociations": {"Quantity": 0},
        "FunctionAssociations": {"Quantity": 0},
        "FieldLevelEncryptionId": "",
    })
behaviors["Quantity"] = len(bitems)

with open(path, "w") as f:
    json.dump(cfg, f)
PY

aws cloudfront update-distribution \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config "file://$TMP/config.json" \
  --query 'Distribution.{Id:Id,Status:Status,DomainName:DomainName}' \
  --output json

echo "CloudFront update submitted (deploys in ~5–15 min)."
