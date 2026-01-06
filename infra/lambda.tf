# ============================================================================
# Lambda Functions
# ============================================================================

# Archive provider is already defined in main.tf
# AWS region data source is defined in s3.tf

# ============================================================================
# Lambda Function: Upload URL Generator
# ============================================================================

# Package upload-url function with shared utilities and dependencies
data "archive_file" "upload_url" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/../backend/functions/files/upload-url.zip"
  excludes = [
    "*.zip",
    ".build/**",
    "functions/**/download-url.js",
    "functions/auth/**",
    "functions/users/**",
    "functions/messages/**",
    "functions/distress/**",
    "package-lock.json"
  ]
}

resource "aws_lambda_function" "upload_url" {
  function_name = "sharepairs-dev-upload-url"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "functions/files/upload-url.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.upload_url.output_path
  source_code_hash = data.archive_file.upload_url.output_base64sha256

  environment {
    variables = {
      USER_UPLOADS_BUCKET  = aws_s3_bucket.user_uploads.id
      UPLOAD_URL_EXPIRATION = "600" # 10 minutes
      FILES_TABLE           = aws_dynamodb_table.files.name
      AUDIT_LOGS_TABLE      = aws_dynamodb_table.audit_logs.name
    }
  }

  tags = {
    Name    = "sharepairs-dev-upload-url"
    Purpose = "Generate presigned S3 upload URLs"
  }
}

# ============================================================================
# Lambda Function: Download URL Generator
# ============================================================================

data "archive_file" "download_url" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/../backend/functions/files/download-url.zip"
  excludes = [
    "*.zip",
    ".build/**",
    "functions/**/upload-url.js",
    "functions/auth/**",
    "functions/users/**",
    "functions/messages/**",
    "functions/distress/**",
    "package-lock.json"
  ]
}

resource "aws_lambda_function" "download_url" {
  function_name = "sharepairs-dev-download-url"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "functions/files/download-url.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.download_url.output_path
  source_code_hash = data.archive_file.download_url.output_base64sha256

  environment {
    variables = {
      USER_UPLOADS_BUCKET     = aws_s3_bucket.user_uploads.id
      DOWNLOAD_URL_EXPIRATION = "900" # 15 minutes
      FILES_TABLE             = aws_dynamodb_table.files.name
      AUDIT_LOGS_TABLE        = aws_dynamodb_table.audit_logs.name
    }
  }

  tags = {
    Name    = "sharepairs-dev-download-url"
    Purpose = "Generate presigned S3 download URLs"
  }
}

# ============================================================================
# Lambda Function: Distress Alert Submission
# ============================================================================

data "archive_file" "distress_submit" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/../backend/functions/distress/submit.zip"
  excludes = [
    "*.zip",
    ".build/**",
    "functions/**/download-url.js",
    "functions/**/upload-url.js",
    "functions/**/worker.js",
    "functions/auth/**",
    "functions/users/**",
    "functions/messages/**",
    "functions/files/**"
  ]
}

resource "aws_lambda_function" "distress_submit" {
  function_name = "sharepairs-dev-distress-submit"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "functions/distress/submit.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.distress_submit.output_path
  source_code_hash = data.archive_file.distress_submit.output_base64sha256

  environment {
    variables = {
      DISTRESS_THRESHOLD            = "70"
      DISTRESS_RATE_LIMIT_MINUTES   = "15"
      DISTRESS_QUEUE_URL            = aws_sqs_queue.distress_alerts.url
      DISTRESS_EVENTS_TABLE         = aws_dynamodb_table.distress_events.name
      AUDIT_LOGS_TABLE              = aws_dynamodb_table.audit_logs.name
    }
  }

  tags = {
    Name    = "sharepairs-dev-distress-submit"
    Purpose = "Submit distress alerts and queue notifications"
  }
}

# ============================================================================
# Lambda Function: Distress Alert Worker (SQS-triggered)
# ============================================================================

data "archive_file" "distress_worker" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/../backend/functions/distress/worker.zip"
  excludes = [
    "*.zip",
    ".build/**",
    "functions/**/download-url.js",
    "functions/**/upload-url.js",
    "functions/**/submit.js",
    "functions/auth/**",
    "functions/users/**",
    "functions/messages/**",
    "functions/files/**"
  ]
}

resource "aws_lambda_function" "distress_worker" {
  function_name = "sharepairs-dev-distress-worker"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "functions/distress/worker.handler"
  runtime       = "nodejs20.x"
  timeout       = 60  # Longer timeout for email sending
  memory_size   = 256

  filename         = data.archive_file.distress_worker.output_path
  source_code_hash = data.archive_file.distress_worker.output_base64sha256

  environment {
    variables = {
      SUPPORT_EMAIL           = "support@sharepairs.com"  # Update with actual email
      STUDY_EMAIL             = "study@sharepairs.com"    # Update with actual email
      SES_SENDER_EMAIL        = "alerts@sharepairs.com"  # Must be verified in SES
      SES_CONFIGURATION_SET   = aws_ses_configuration_set.distress_alerts.name
      DISTRESS_EVENTS_TABLE   = aws_dynamodb_table.distress_events.name
      AUDIT_LOGS_TABLE        = aws_dynamodb_table.audit_logs.name
      DISTRESS_THRESHOLD      = "70"
    }
  }

  tags = {
    Name    = "sharepairs-dev-distress-worker"
    Purpose = "Process distress alerts from SQS and send emails via SES"
  }
}

# SQS Event Source Mapping - Trigger worker Lambda when messages arrive
resource "aws_lambda_event_source_mapping" "distress_worker" {
  event_source_arn                   = aws_sqs_queue.distress_alerts.arn
  function_name                      = aws_lambda_function.distress_worker.arn
  batch_size                         = 1  # Process one message at a time for reliability
  maximum_batching_window_in_seconds = 0  # Process immediately
  enabled                            = true

  # Retry configuration
  maximum_retry_attempts = 3  # Retry 3 times before sending to DLQ
}

