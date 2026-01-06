# ============================================================================
# CloudWatch Alarms for Distress Alert System
# ============================================================================

# ============================================================================
# Alarm: DLQ Depth (Dead Letter Queue has messages)
# ============================================================================
# 
# This alarm triggers when messages end up in the DLQ, indicating
# that the worker Lambda is failing to process distress alerts.
# This is critical for monitoring the notification pipeline.
#
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "distress_dlq_depth" {
  alarm_name          = "sharepairs-dev-distress-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60  # 1 minute
  statistic           = "Average"
  threshold           = 0   # Alert if any messages in DLQ
  alarm_description   = "Alert when messages are in distress alerts DLQ (worker failures)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.distress_alerts_dlq.name
  }

  tags = {
    Name    = "sharepairs-dev-distress-dlq-alarm"
    Purpose = "Monitor distress alert notification failures"
  }
}

# ============================================================================
# Alarm: Worker Lambda Errors
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "distress_worker_errors" {
  alarm_name          = "sharepairs-dev-distress-worker-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 5    # Alert if more than 5 errors in 5 minutes
  alarm_description   = "Alert when distress worker Lambda has errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.distress_worker.function_name
  }

  tags = {
    Name    = "sharepairs-dev-distress-worker-errors"
    Purpose = "Monitor distress worker Lambda errors"
  }
}

