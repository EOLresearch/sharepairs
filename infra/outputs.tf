# ============================================================================
# Outputs - Values you'll reference later in other Terraform configs or CLI
# ============================================================================

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role (use this when creating Lambda functions)"
  value       = aws_iam_role.lambda_execution.arn
}

output "cognito_authenticated_role_arn" {
  description = "ARN of the Cognito authenticated role (use this when creating Cognito Identity Pool)"
  value       = aws_iam_role.cognito_authenticated.arn
}

# ============================================================================
# Cognito Outputs
# ============================================================================

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID (use this in your frontend/backend config)"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_user_pool_endpoint" {
  description = "Cognito User Pool endpoint URL"
  value       = aws_cognito_user_pool.main.endpoint
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID (use this in your frontend/backend config)"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain (for hosted UI)"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "cognito_user_pool_domain_url" {
  description = "Cognito User Pool Domain URL (for hosted UI authentication)"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID (use this in your frontend config for AWS resource access)"
  value       = aws_cognito_identity_pool.main.id
}

# ============================================================================
# S3 Outputs
# ============================================================================

output "user_uploads_bucket_name" {
  description = "Name of the user uploads bucket"
  value       = aws_s3_bucket.user_uploads.id
}

output "logs_bucket_name" {
  description = "Name of the logs bucket"
  value       = aws_s3_bucket.logs.id
}

output "kms_key_id" {
  description = "KMS key ID used for S3 encryption"
  value       = aws_kms_key.s3.id
}

output "kms_key_arn" {
  description = "KMS key ARN used for S3 encryption"
  value       = aws_kms_key.s3.arn
}

# ============================================================================
# Auditing Outputs
# ============================================================================

output "cloudtrail_name" {
  description = "Name of the CloudTrail trail for audit logging"
  value       = aws_cloudtrail.main.name
}

output "cloudtrail_arn" {
  description = "ARN of the CloudTrail trail"
  value       = aws_cloudtrail.main.arn
}

output "config_recorder_name" {
  description = "Name of the AWS Config recorder"
  value       = aws_config_configuration_recorder.main.name
}

# ============================================================================
# CloudFront Outputs
# ============================================================================

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (use this URL to access your app)"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.frontend.arn
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend static site"
  value       = aws_s3_bucket.frontend.id
}

# ============================================================================
# API Gateway Outputs
# ============================================================================

output "api_gateway_id" {
  description = "API Gateway REST API ID"
  value       = aws_apigatewayv2_api.main.id
}

output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL (use this to call your APIs)"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_gateway_arn" {
  description = "API Gateway REST API ARN"
  value       = aws_apigatewayv2_api.main.arn
}

output "api_gateway_execution_arn" {
  description = "API Gateway execution ARN (use this for Lambda permissions)"
  value       = aws_apigatewayv2_api.main.execution_arn
}

# ============================================================================
# DynamoDB Outputs
# ============================================================================

output "files_table_name" {
  description = "Name of the files DynamoDB table"
  value       = aws_dynamodb_table.files.name
}

output "audit_logs_table_name" {
  description = "Name of the audit logs DynamoDB table"
  value       = aws_dynamodb_table.audit_logs.name
}

output "distress_events_table_name" {
  description = "Name of the distress events DynamoDB table"
  value       = aws_dynamodb_table.distress_events.name
}

# ============================================================================
# SQS Outputs
# ============================================================================

output "distress_alerts_queue_url" {
  description = "URL of the distress alerts SQS queue"
  value       = aws_sqs_queue.distress_alerts.url
}

output "distress_alerts_queue_arn" {
  description = "ARN of the distress alerts SQS queue"
  value       = aws_sqs_queue.distress_alerts.arn
}

output "distress_alerts_dlq_url" {
  description = "URL of the distress alerts dead letter queue"
  value       = aws_sqs_queue.distress_alerts_dlq.url
}

# ============================================================================
# SES Outputs
# ============================================================================

output "ses_configuration_set_name" {
  description = "Name of the SES configuration set for distress alerts"
  value       = aws_ses_configuration_set.distress_alerts.name
}

