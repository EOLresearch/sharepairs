# ============================================================================
# SQS Queues for Distress Alerts
# ============================================================================

# ============================================================================
# Dead Letter Queue (DLQ) - Receives failed messages after max retries
# ============================================================================

resource "aws_sqs_queue" "distress_alerts_dlq" {
  name                      = "sharepairs-dev-distress-alerts-dlq"
  message_retention_seconds = 1209600 # 14 days (max retention)

  tags = {
    Name        = "sharepairs-dev-distress-alerts-dlq"
    Purpose     = "Dead letter queue for failed distress alert notifications"
    HIPAA       = "Compliant"
  }
}

# ============================================================================
# Main Distress Alerts Queue
# ============================================================================

resource "aws_sqs_queue" "distress_alerts" {
  name                      = "sharepairs-dev-distress-alerts"
  message_retention_seconds = 345600 # 4 days
  visibility_timeout_seconds = 60    # Worker has 60s to process message
  receive_wait_time_seconds  = 20    # Long polling (20s)

  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.distress_alerts_dlq.arn
    maxReceiveCount     = 5 # After 5 failed attempts, send to DLQ
  })

  # Encryption at rest
  # Note: SQS doesn't support KMS encryption directly in this way
  # Encryption is handled via server-side encryption (SSE) by default

  tags = {
    Name        = "sharepairs-dev-distress-alerts"
    Purpose     = "Queue for distress alert email notifications"
    HIPAA       = "Compliant"
  }
}

# Grant Lambda permission to receive messages from SQS
resource "aws_sqs_queue_policy" "distress_alerts" {
  queue_url = aws_sqs_queue.distress_alerts.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.distress_alerts.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_lambda_function.distress_worker.arn
          }
        }
      }
    ]
  })
}

