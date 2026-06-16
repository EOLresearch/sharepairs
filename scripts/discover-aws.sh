#!/usr/bin/env bash
# Print discovered AWS resource IDs for the current account/region.
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-2}"
export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"

echo "Region:   $AWS_REGION"
echo "Account:  $(aws sts get-caller-identity --query Account --output text)"
echo ""
echo "Expected account (override with AWS_ACCOUNT_ID): ${AWS_ACCOUNT_ID:-562395967936}"
echo ""

echo "S3 frontend bucket:"
aws s3api list-buckets --query "Buckets[?contains(Name, 'sharepairs')].Name" --output table 2>/dev/null || echo "  (none found)"

echo ""
echo "API Gateway (HTTP):"
aws apigatewayv2 get-apis --region "$AWS_REGION" \
  --query "Items[?contains(Name, 'sharepairs')].{Name:Name,Id:ApiId,Endpoint:ApiEndpoint}" \
  --output table 2>/dev/null || echo "  (none found)"

echo ""
echo "Lambda functions:"
aws lambda list-functions --region "$AWS_REGION" \
  --query "Functions[?contains(FunctionName, 'sharepairs')].FunctionName" \
  --output table 2>/dev/null || echo "  (none found)"

echo ""
echo "CloudFront distributions:"
aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Comment, 'Share') || contains(Comment, 'sharepairs')].{Id:Id,Domain:DomainName,Status:Status,Comment:Comment}" \
  --output table 2>/dev/null || echo "  (none found)"

echo ""
echo "If infra is not provisioned yet, run from CloudShell:"
echo "  cd infra && terraform init && terraform apply"
