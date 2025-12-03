# ============================================================================
# CloudTrail & AWS Config - HIPAA Compliance Auditing
# ============================================================================
# 
# AUDITING SERVICES EXPLAINED:
# -----------------------------
# 
# CloudTrail:
# - Logs ALL API calls made to AWS services
# - Records: Who did what, when, from where, and what resources were accessed
# - Essential for HIPAA compliance (audit trail)
# - Answers: "Who accessed that S3 bucket?" "When was this Lambda modified?"
#
# AWS Config:
# - Tracks changes to your AWS resources over time
# - Records: Configuration changes, compliance status
# - Essential for HIPAA compliance (configuration management)
# - Answers: "When did this security group change?" "Is encryption enabled?"
#
# Why Both?
# - CloudTrail = Activity logging (who did what)
# - Config = Configuration tracking (what changed)
# - Together = Complete audit trail for HIPAA
#
# ============================================================================

# Get current AWS account ID and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ============================================================================
# CloudTrail - API Activity Logging
# ============================================================================

# S3 bucket for CloudTrail logs (we'll use our existing logs bucket)
# CloudTrail needs a dedicated prefix within the bucket

# IAM role for CloudTrail to write logs
resource "aws_iam_role" "cloudtrail" {
  name = "sharepairs-cloudtrail-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "sharepairs-cloudtrail-role"
    Purpose = "CloudTrail log delivery"
  }
}

# Policy for CloudTrail to write to S3
resource "aws_iam_role_policy" "cloudtrail" {
  name = "sharepairs-cloudtrail-policy"
  role = aws_iam_role.cloudtrail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetBucketAcl"
        ]
        Resource = [
          "${aws_s3_bucket.logs.arn}/cloudtrail/*",
          aws_s3_bucket.logs.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:sharepairs-cloudtrail:*"
      }
    ]
  })
}

# CloudWatch Log Group for CloudTrail (must be created before CloudTrail)
resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "sharepairs-cloudtrail"
  retention_in_days = 90  # Keep logs for 90 days (adjust per HIPAA retention)

  tags = {
    Name    = "sharepairs-cloudtrail"
    Purpose = "CloudTrail log aggregation"
  }
}

# CloudTrail Trail - logs all API activity
resource "aws_cloudtrail" "main" {
  name           = "sharepairs-audit-trail"
  s3_bucket_name = aws_s3_bucket.logs.id
  s3_key_prefix  = "cloudtrail/"

  include_global_service_events = true  # Log all AWS services
  is_multi_region_trail         = true  # Track activity across all regions
  enable_logging                = true
  enable_log_file_validation    = true  # Verify log integrity

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail.arn

  event_selector {
    read_write_type                 = "All"
    include_management_events       = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.user_uploads.arn}/*"]  # Log S3 access
    }
  }

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::DynamoDB::Table"
      values = ["arn:aws:dynamodb:*:*:table/sharepairs-dev-*"]  # Log DynamoDB access
    }
  }

  tags = {
    Name        = "sharepairs-audit-trail"
    Purpose     = "HIPAA compliance audit logging"
    HIPAA       = "Compliant"
  }

  depends_on = [
    aws_s3_bucket_policy.logs,
    aws_cloudwatch_log_group.cloudtrail
  ]
}

# S3 bucket policy for logs bucket (allows CloudTrail and Config to write)
# Note: This policy allows both CloudTrail and Config to write to the logs bucket

# ============================================================================
# AWS Config - Configuration Tracking
# ============================================================================

# S3 bucket for AWS Config snapshots (we'll use our logs bucket)
# Config needs a dedicated prefix

# IAM role for AWS Config
resource "aws_iam_role" "config" {
  name = "sharepairs-config-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name    = "sharepairs-config-role"
    Purpose = "AWS Config service role"
  }
}

# Policy for AWS Config to read/write
resource "aws_iam_role_policy" "config" {
  name = "sharepairs-config-policy"
  role = aws_iam_role.config.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.logs.arn}/config/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Effect = "Allow"
        Action = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.logs.arn
      },
      {
        Effect = "Allow"
        Action = [
          "config:Put*",
          "config:Get*",
          "config:List*",
          "config:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
}

# AWS Config Configuration Recorder - tracks resource changes
resource "aws_config_configuration_recorder" "main" {
  name     = "sharepairs-config-recorder"
  role_arn = aws_iam_role.config.arn

  recording_group {
    all_supported                 = true   # Record all supported resource types
    include_global_resource_types = true   # Include global resources (IAM, etc.)
  }
}

# AWS Config Delivery Channel - where to send configuration snapshots
resource "aws_config_delivery_channel" "main" {
  name           = "sharepairs-config-delivery"
  s3_bucket_name = aws_s3_bucket.logs.id
  s3_key_prefix  = "config/"

  snapshot_delivery_properties {
    delivery_frequency = "TwentyFour_Hours"  # Daily snapshots
  }

  depends_on = [aws_config_configuration_recorder.main]
}

# Start the configuration recorder
resource "aws_config_configuration_recorder_status" "main" {
  name       = aws_config_configuration_recorder.main.name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

# S3 bucket policy for logs bucket - merged policy for CloudTrail + Config
resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudTrail permissions
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.logs.arn
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/sharepairs-audit-trail"
          }
        }
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.logs.arn}/cloudtrail/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl"      = "bucket-owner-full-control"
            "AWS:SourceArn"     = "arn:aws:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/sharepairs-audit-trail"
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      # AWS Config permissions
      {
        Sid    = "AWSConfigAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.logs.arn
      },
      {
        Sid    = "AWSConfigWrite"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.logs.arn}/config/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

