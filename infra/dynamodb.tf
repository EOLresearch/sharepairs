# ============================================================================
# DynamoDB Tables
# ============================================================================

# ============================================================================
# Files Table - Tracks file metadata
# ============================================================================

resource "aws_dynamodb_table" "files" {
  name           = "sharepairs-dev-files"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "N"
  }

  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "sharepairs-dev-files"
    Purpose     = "File metadata tracking"
    HIPAA       = "Compliant"
  }
}

# ============================================================================
# Audit Logs Table - Append-only audit log
# ============================================================================

resource "aws_dynamodb_table" "audit_logs" {
  name           = "sharepairs-dev-audit-logs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "timestamp"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "timestamp"
    type = "N"
  }
  attribute {
    name = "event_type"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "event-type-index"
    hash_key        = "event_type"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "sharepairs-dev-audit-logs"
    Purpose     = "Append-only audit log for compliance and IRB requirements"
    HIPAA       = "Compliant"
  }
}

# ============================================================================
# Distress Events Table - Tracks distress alerts
# ============================================================================

resource "aws_dynamodb_table" "distress_events" {
  name           = "sharepairs-dev-distress-events"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "N"
  }
  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "sharepairs-dev-distress-events"
    Purpose     = "Distress alert tracking and notification status"
    HIPAA       = "Compliant"
  }
}

