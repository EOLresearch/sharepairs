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

