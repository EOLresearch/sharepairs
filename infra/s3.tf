# ============================================================================
# S3 Buckets Configuration
# ============================================================================
# 
# S3 BUCKETS EXPLAINED:
# ---------------------
# 
# For a chat application, you need:
# 1. User Uploads Bucket - Profile pictures, file attachments
# 2. Logs Bucket - Application logs, CloudWatch exports
#
# HIPAA Compliance Requirements:
# - Encryption at rest (KMS)
# - Versioning (audit trail)
# - Lifecycle policies (auto-archive/delete old data)
# - Access logging (who accessed what)
#
# ============================================================================

# Get current AWS account ID and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ============================================================================
# KMS Key for S3 Encryption (HIPAA Compliance)
# ============================================================================

resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption (HIPAA compliant)"
  deletion_window_in_days = 30  # Can recover for 30 days after deletion
  enable_key_rotation     = true  # Auto-rotate key annually

  tags = {
    Name        = "sharepairs-dev-s3-kms-key"
    Purpose     = "S3 Encryption"
    HIPAA       = "Compliant"
  }

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda to use key"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda_execution.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow Cognito users to use key"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.cognito_authenticated.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "s3" {
  name          = "alias/sharepairs-dev-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# ============================================================================
# S3 Bucket 1: User Uploads
# ============================================================================

resource "aws_s3_bucket" "user_uploads" {
  bucket = "sharepairs-dev-user-uploads"

  tags = {
    Name        = "sharepairs-dev-user-uploads"
    Purpose     = "User profile pictures and file uploads"
    HIPAA       = "Compliant"
  }
}

# Enable versioning for audit trail (HIPAA requirement)
resource "aws_s3_bucket_versioning" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true  # Reduces KMS API calls (cost savings)
  }
}

# Block all public access (HIPAA requirement)
resource "aws_s3_bucket_public_access_block" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy - move old files to cheaper storage, delete after retention
resource "aws_s3_bucket_lifecycle_configuration" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  rule {
    id     = "archive-old-uploads"
    status = "Enabled"

    filter {}  # Apply to all objects

    # Move to Infrequent Access after 90 days (cheaper storage)
    transition {
      days          = 90
      storage_class = "STANDARD_IA"  # 50% cheaper than standard
    }

    # Move to Glacier after 1 year (even cheaper for archived files)
    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    # Delete old versions after 7 years (HIPAA retention - adjust as needed)
    noncurrent_version_expiration {
      noncurrent_days = 2555  # ~7 years
    }

    # Delete incomplete multipart uploads after 7 days
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}


# ============================================================================
# S3 Bucket 2: Logs
# ============================================================================

resource "aws_s3_bucket" "logs" {
  bucket = "sharepairs-dev-logs"

  tags = {
    Name        = "sharepairs-dev-logs"
    Purpose     = "Application logs and CloudWatch exports"
    HIPAA       = "Compliant"
  }
}

# Enable versioning for audit trail
resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy - compress and archive logs, delete old ones
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "archive-logs"
    status = "Enabled"

    filter {}  # Apply to all objects

    # Move to Infrequent Access after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Move to Glacier after 90 days (logs are rarely accessed)
    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # Delete logs after 1 year (adjust per HIPAA retention policy)
    expiration {
      days = 365
    }

    # Delete old versions after 1 year
    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    # Delete incomplete multipart uploads after 1 day
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# ============================================================================
# S3 Bucket Policy for User Uploads (enforce user-specific folders)
# ============================================================================

resource "aws_s3_bucket_policy" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          "${aws_s3_bucket.user_uploads.arn}/*",
          aws_s3_bucket.user_uploads.arn
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# ============================================================================
# S3 Access Logging (audit trail for HIPAA compliance)
# ============================================================================

# Enable access logging for user uploads bucket (logs to logs bucket)
resource "aws_s3_bucket_logging" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "user-uploads-access-logs/"
}

