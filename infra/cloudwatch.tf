# ============================================================================
# CloudWatch Metrics + Alarms - Comprehensive Monitoring
# ============================================================================
# 
# This file sets up automatic visibility and alerts for:
# - API Gateway (5XX errors, latency, 4XX errors)
# - Lambda functions (errors, throttles)
# - SQS queues (DLQ depth)
#
# All alarms notify via SNS topic (email subscription)
# ============================================================================

# ============================================================================
# SNS Topic for Alerts
# ============================================================================

resource "aws_sns_topic" "alerts" {
  name = "sharepairs-dev-alerts"
  
  tags = {
    Name    = "sharepairs-dev-alerts"
    Purpose = "CloudWatch alarm notifications"
  }
}

# Email subscription - UPDATE THIS WITH YOUR EMAIL ADDRESS
# After deploying, AWS will send a confirmation email that must be confirmed
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "your-email@example.com"  # TODO: Update with your email address
}

# ============================================================================
# API Gateway Alarms
# ============================================================================

# Alarm: API Gateway 5XX Errors (Backend Failures)
# This indicates users are hitting server errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "sharepairs-dev-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 5    # Alert if more than 5 errors in 5 minutes
  alarm_description   = "Alert when API Gateway returns 5XX errors (backend failures)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_apigatewayv2_api.main.name
    Stage   = aws_apigatewayv2_stage.production.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-api-5xx-errors"
    Purpose = "Monitor API Gateway server errors"
  }
}

# Alarm: API Gateway Latency (Slow Backend)
# Alert if p95 latency exceeds 2 seconds for 5 minutes
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "sharepairs-dev-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300  # 5 minutes
  statistic           = "Average"
  threshold           = 2000  # 2 seconds in milliseconds
  alarm_description   = "Alert when API Gateway latency exceeds 2 seconds"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_apigatewayv2_api.main.name
    Stage   = aws_apigatewayv2_stage.production.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-api-latency"
    Purpose = "Monitor API Gateway response times"
  }
}

# Alarm: API Gateway 4XX Errors (Client Errors - Watch for Spikes)
# This helps detect abuse or misconfigured clients
resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  alarm_name          = "sharepairs-dev-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 50   # Alert if more than 50 client errors in 5 minutes
  alarm_description   = "Alert when API Gateway returns high number of 4XX errors (possible abuse or misconfiguration)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_apigatewayv2_api.main.name
    Stage   = aws_apigatewayv2_stage.production.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-api-4xx-errors"
    Purpose = "Monitor API Gateway client errors"
  }
}

# ============================================================================
# Lambda Function Alarms - Errors
# ============================================================================

# Alarm: Upload URL Lambda Errors
resource "aws_cloudwatch_metric_alarm" "lambda_upload_url_errors" {
  alarm_name          = "sharepairs-dev-lambda-upload-url-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 1     # Alert if any errors occur
  alarm_description   = "Alert when upload-url Lambda function has errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.upload_url.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-lambda-upload-url-errors"
    Purpose = "Monitor upload-url Lambda errors"
  }
}

# Alarm: Download URL Lambda Errors
resource "aws_cloudwatch_metric_alarm" "lambda_download_url_errors" {
  alarm_name          = "sharepairs-dev-lambda-download-url-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 1     # Alert if any errors occur
  alarm_description   = "Alert when download-url Lambda function has errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.download_url.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-lambda-download-url-errors"
    Purpose = "Monitor download-url Lambda errors"
  }
}

# Alarm: Distress Submit Lambda Errors
resource "aws_cloudwatch_metric_alarm" "lambda_distress_submit_errors" {
  alarm_name          = "sharepairs-dev-lambda-distress-submit-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 1     # Alert if any errors occur
  alarm_description   = "Alert when distress-submit Lambda function has errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.distress_submit.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-lambda-distress-submit-errors"
    Purpose = "Monitor distress-submit Lambda errors"
  }
}

# Alarm: Distress Worker Lambda Errors (Updated)
resource "aws_cloudwatch_metric_alarm" "distress_worker_errors" {
  alarm_name          = "sharepairs-dev-distress-worker-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 1     # Alert if any errors occur (changed from 5 to 1 for consistency)
  alarm_description   = "Alert when distress worker Lambda has errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.distress_worker.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-distress-worker-errors"
    Purpose = "Monitor distress worker Lambda errors"
  }
}

# ============================================================================
# Lambda Function Alarms - Throttles
# ============================================================================

# Alarm: Upload URL Lambda Throttles
resource "aws_cloudwatch_metric_alarm" "lambda_upload_url_throttles" {
  alarm_name          = "sharepairs-dev-lambda-upload-url-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 0     # Alert if any throttles occur
  alarm_description   = "Alert when upload-url Lambda function is throttled (concurrency/capacity issue)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.upload_url.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-lambda-upload-url-throttles"
    Purpose = "Monitor upload-url Lambda throttles"
  }
}

# Alarm: Download URL Lambda Throttles
resource "aws_cloudwatch_metric_alarm" "lambda_download_url_throttles" {
  alarm_name          = "sharepairs-dev-lambda-download-url-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 0     # Alert if any throttles occur
  alarm_description   = "Alert when download-url Lambda function is throttled (concurrency/capacity issue)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.download_url.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-lambda-download-url-throttles"
    Purpose = "Monitor download-url Lambda throttles"
  }
}

# Alarm: Distress Submit Lambda Throttles
resource "aws_cloudwatch_metric_alarm" "lambda_distress_submit_throttles" {
  alarm_name          = "sharepairs-dev-lambda-distress-submit-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 0     # Alert if any throttles occur
  alarm_description   = "Alert when distress-submit Lambda function is throttled (concurrency/capacity issue)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.distress_submit.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-lambda-distress-submit-throttles"
    Purpose = "Monitor distress-submit Lambda throttles"
  }
}

# Alarm: Distress Worker Lambda Throttles
resource "aws_cloudwatch_metric_alarm" "lambda_distress_worker_throttles" {
  alarm_name          = "sharepairs-dev-lambda-distress-worker-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 0     # Alert if any throttles occur
  alarm_description   = "Alert when distress-worker Lambda function is throttled (concurrency/capacity issue)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.distress_worker.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-lambda-distress-worker-throttles"
    Purpose = "Monitor distress-worker Lambda throttles"
  }
}

# ============================================================================
# SQS Alarms
# ============================================================================

# Alarm: DLQ Depth (Dead Letter Queue has messages)
# This alarm triggers when messages end up in the DLQ, indicating
# that the worker Lambda is failing to process distress alerts.
# This is critical for monitoring the notification pipeline.
resource "aws_cloudwatch_metric_alarm" "distress_dlq_depth" {
  alarm_name          = "sharepairs-dev-distress-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60  # 1 minute
  statistic           = "Average"
  threshold           = 0   # Alert if any messages in DLQ
  alarm_description   = "Alert when messages are in distress alerts DLQ (worker failures) - HIGH PRIORITY"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.distress_alerts_dlq.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "sharepairs-dev-distress-dlq-alarm"
    Purpose = "Monitor distress alert notification failures"
  }
}

