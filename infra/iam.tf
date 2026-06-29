# ============================================================================
# IAM Roles and Policies
# ============================================================================
# 
# IAM ROLES EXPLAINED:
# ----------------------------------------
# 
# IAM Users vs IAM Roles:
# - IAM User (like "sharepairs-admin"): A person or service account that you use
#   to log into AWS Console or run AWS CLI commands. Has permanent credentials.
# 
# - IAM Role: A set of permissions that AWS SERVICES (not you) can temporarily
#   "put on" to access other AWS services. Think of it like a keycard badge.
# 
# Why Roles Matter:
# - Lambda functions need a role to access RDS, S3, etc. (they can't use your 
#   user credentials)
# - Your React app needs a role (via Cognito) to upload files to S3
# - Roles follow "least privilege" - only grant what's absolutely needed
#
# ============================================================================

# ============================================================================
# Lambda execution role — ITS-provided (webdev-lambda-role)
# ============================================================================
# Fabrice provisioned this role; we reference it instead of creating our own.
# Requires iam:PassRole (already granted) when creating Lambda functions.

data "aws_iam_role" "lambda_execution" {
  name = var.lambda_execution_role_name
}

# App-specific permissions on the shared webdev role (requires iam:PutRolePolicy).
resource "aws_iam_role_policy" "lambda_custom" {
  name = "sharepairs-dev-lambda-custom-policy"
  role = data.aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Allow Lambda to read/write to DynamoDB tables (only YOUR project tables)
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:*:*:table/sharepairs-dev-*",           # Tables
          "arn:aws:dynamodb:*:*:table/sharepairs-dev-*/index/*"    # Global Secondary Indexes
        ]
      },
      {
        # Allow Lambda to read/write to S3 buckets (only YOUR project buckets)
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::sharepairs-dev-${data.aws_caller_identity.current.account_id}-*/*",
          "arn:aws:s3:::sharepairs-dev-${data.aws_caller_identity.current.account_id}-*",
          "arn:aws:s3:::sharepairs-dev-*/*",
          "arn:aws:s3:::sharepairs-dev-*"
        ]
      },
      {
        # Allow Lambda to use KMS key for S3 encryption/decryption
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
        # Note: KMS key policy will further restrict this to specific keys
      },
      {
        # Allow Lambda to send messages to SQS (for distress alerts)
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          "arn:aws:sqs:*:*:sharepairs-dev-distress-alerts",
          "arn:aws:sqs:*:*:sharepairs-dev-distress-alerts-dlq"
        ]
      },
      {
        # Allow Lambda to receive and delete messages from SQS (for worker)
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          "arn:aws:sqs:*:*:sharepairs-dev-distress-alerts",
          "arn:aws:sqs:*:*:sharepairs-dev-distress-alerts-dlq"
        ]
      },
      {
        # Allow Lambda to send emails via SES
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        # Note: SES identity verification (email/domain) must be done separately
      },
      {
        # Allow Lambda to push messages to WebSocket clients
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections",
          "execute-api:Invoke"
        ]
        Resource = [
          "arn:aws:execute-api:*:*:*/*/@connections/*"
        ]
      }
    ]
  })
}

# ============================================================================
# ROLE 2: Cognito Authenticated User Role
# ============================================================================
#
# What it does:
# - Gives authenticated users (via Cognito) permission to access AWS services
# - Used when your React app needs to upload files to S3, etc.
# - Users "assume" this role after logging in through Cognito
#
# What permissions it needs (LEAN):
# 1. S3 - Upload files to user-specific folders
# 2. Cognito Identity - Get their identity ID
#
# ============================================================================

resource "aws_iam_role" "cognito_authenticated" {
  name = "sharepairs-dev-cognito-authenticated-role"

  # This policy says "Cognito Identity service can assume this role for authenticated users"
  # Note: We reference the identity pool ID here, which creates a dependency.
  # Terraform will handle the creation order correctly.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "sharepairs-dev-cognito-authenticated-role"
    Description = "Role for authenticated users to access AWS services from frontend"
  }
}

# Custom policy for authenticated users (VERY LEAN - only what users need)
resource "aws_iam_role_policy" "cognito_authenticated" {
  name = "sharepairs-dev-cognito-authenticated-policy"
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Users can only upload to their own folder in S3
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.user_uploads.arn}/$${aws:userid}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.user_uploads.arn
        Condition = {
          StringLike = {
            "s3:prefix" = "$${aws:userid}/*"  # Only their folder (escaped for Terraform)
          }
        }
      },
      {
        # Users can get their Cognito identity (required)
        Effect = "Allow"
        Action = [
          "cognito-identity:GetId",
          "cognito-identity:GetCredentialsForIdentity"
        ]
        Resource = "*"
      }
    ]
  })
}

