# ============================================================================
# CloudTrail & AWS Config - HIPAA Compliance Auditing
# Disabled by default (enable_auditing=true) — requires extra IAM permissions.
# ============================================================================

resource "aws_iam_role" "cloudtrail" {
  count = var.enable_auditing ? 1 : 0
  name  = "sharepairs-cloudtrail-role"

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
    Name    = "sharepairs-cloudtrail-role"
    Purpose = "CloudTrail log delivery"
  }
}

resource "aws_iam_role_policy" "cloudtrail" {
  count = var.enable_auditing ? 1 : 0
  name  = "sharepairs-cloudtrail-policy"
  role  = aws_iam_role.cloudtrail[0].id

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

resource "aws_cloudwatch_log_group" "cloudtrail" {
  count             = var.enable_auditing ? 1 : 0
  name              = "sharepairs-cloudtrail"
  retention_in_days = 90

  tags = {
    Name    = "sharepairs-cloudtrail"
    Purpose = "CloudTrail log aggregation"
  }
}

resource "aws_cloudtrail" "main" {
  count          = var.enable_auditing ? 1 : 0
  name           = "sharepairs-audit-trail"
  s3_bucket_name = aws_s3_bucket.logs.id
  s3_key_prefix  = "cloudtrail/"

  include_global_service_events = true
  is_multi_region_trail         = true
  enable_logging                = true
  enable_log_file_validation    = true

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail[0].arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail[0].arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.user_uploads.arn}/*"]
    }
  }

  tags = {
    Name    = "sharepairs-audit-trail"
    Purpose = "HIPAA compliance audit logging"
    HIPAA   = "Compliant"
  }

  depends_on = [
    aws_s3_bucket_policy.logs,
    aws_cloudwatch_log_group.cloudtrail,
  ]
}

resource "aws_iam_role" "config" {
  count = var.enable_auditing ? 1 : 0
  name  = "sharepairs-config-role"

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

resource "aws_iam_role_policy" "config" {
  count = var.enable_auditing ? 1 : 0
  name  = "sharepairs-config-policy"
  role  = aws_iam_role.config[0].id

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
        Effect   = "Allow"
        Action   = "s3:GetBucketAcl"
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

resource "aws_config_configuration_recorder" "main" {
  count    = var.enable_auditing ? 1 : 0
  name     = "sharepairs-config-recorder"
  role_arn = aws_iam_role.config[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  count          = var.enable_auditing ? 1 : 0
  name           = "sharepairs-config-delivery"
  s3_bucket_name = aws_s3_bucket.logs.id
  s3_key_prefix  = "config"

  snapshot_delivery_properties {
    delivery_frequency = "TwentyFour_Hours"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

resource "aws_config_configuration_recorder_status" "main" {
  count      = var.enable_auditing ? 1 : 0
  name       = aws_config_configuration_recorder.main[0].name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

resource "aws_s3_bucket_policy" "logs" {
  count  = var.enable_auditing ? 1 : 0
  bucket = aws_s3_bucket.logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
