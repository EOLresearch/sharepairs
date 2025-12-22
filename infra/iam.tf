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
# - Lambda functions need a role to access DynamoDB, S3, etc. (they can't use your 
#   user credentials)
# - Your React app needs a role (via Cognito) to upload files to S3
# - Roles follow "least privilege" - only grant what's absolutely needed
#
# ============================================================================

# ============================================================================
# ROLE 1: Lambda Execution Role
# ============================================================================
# 
# What it does:
# - Gives Lambda functions permission to run and access AWS services
# - Lambda functions "assume" this role when they execute
# 
# What permissions it needs (LEAN):
# 1. CloudWatch Logs - Lambda must write logs (required)
# 2. DynamoDB - Read/write to database tables
# 3. S3 - Read/write files (user uploads, assets)
#
# ============================================================================

resource "aws_iam_role" "lambda_execution" {
  name = "sharepairs-lambda-execution-role"

  # This policy says "Lambda service can assume (use) this role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "sharepairs-lambda-execution-role"
    Description = "Role for Lambda functions to access AWS services"
  }
}

# Attach AWS managed policy for basic Lambda execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  # This gives: logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents
}

# Custom policy for Lambda to access YOUR specific resources (LEAN permissions)
resource "aws_iam_role_policy" "lambda_custom" {
  name = "sharepairs-lambda-custom-policy"
  role = aws_iam_role.lambda_execution.id

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
          "arn:aws:s3:::sharepairs-dev-*/*",  # Only buckets starting with "sharepairs-dev-"
          "arn:aws:s3:::sharepairs-dev-*"     # Bucket itself (for ListBucket)
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
  name = "sharepairs-cognito-authenticated-role"

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
    Name        = "sharepairs-cognito-authenticated-role"
    Description = "Role for authenticated users to access AWS services from frontend"
  }
}

# Custom policy for authenticated users (VERY LEAN - only what users need)
resource "aws_iam_role_policy" "cognito_authenticated" {
  name = "sharepairs-cognito-authenticated-policy"
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
          "arn:aws:s3:::sharepairs-dev-user-uploads/$${aws:userid}/*"  # ${aws:userid} = their Cognito identity ID (escaped for Terraform)
        ]
      },
      {
        # Users can list their own folder (to see their uploads)
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::sharepairs-dev-user-uploads"
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

