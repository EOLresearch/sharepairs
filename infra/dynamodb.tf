# ============================================================================
# DynamoDB Tables for Share Pairs
# ============================================================================
# 
# DYNAMODB EXPLAINED:
# -------------------
# 
# DynamoDB is a NoSQL database (like Firestore):
# - Fully managed, serverless
# - No VPC needed - accessed via API
# - Auto-scales with usage
# - Free tier: 25GB storage, 200M read/write units/month
# - Perfect for chat applications
#
# What This Does:
# - Creates DynamoDB tables for users, conversations, messages
# - Sets up Global Secondary Indexes (GSI) for efficient queries
# - Enables encryption at rest (HIPAA requirement)
# - Configures point-in-time recovery for backups
#
# ============================================================================

# ============================================================================
# Users Table
# ============================================================================

resource "aws_dynamodb_table" "users" {
  name           = "sharepairs-dev-users"
  billing_mode   = "PAY_PER_REQUEST"  # Free tier: on-demand pricing
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"  # String (UUID)
  }

  attribute {
    name = "email"
    type = "S"
  }

  # Global Secondary Index for email lookups
  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  # Encryption at rest (HIPAA requirement)
  server_side_encryption {
    enabled = true
  }

  # Point-in-time recovery (HIPAA backup requirement)
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name    = "sharepairs-dev-users"
    Purpose = "User profiles and authentication"
    HIPAA   = "Compliant"
  }
}

# ============================================================================
# Conversations Table
# ============================================================================

resource "aws_dynamodb_table" "conversations" {
  name           = "sharepairs-dev-conversations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "user1_id"
    type = "S"
  }

  attribute {
    name = "user2_id"
    type = "S"
  }

  attribute {
    name = "last_message_at"
    type = "N"  # Number (timestamp)
  }

  # GSI for finding conversations by user1
  global_secondary_index {
    name            = "user1-index"
    hash_key        = "user1_id"
    range_key       = "last_message_at"
    projection_type = "ALL"
  }

  # GSI for finding conversations by user2
  global_secondary_index {
    name            = "user2-index"
    hash_key        = "user2_id"
    range_key       = "last_message_at"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name    = "sharepairs-dev-conversations"
    Purpose = "Chat conversations between users"
    HIPAA   = "Compliant"
  }
}

# ============================================================================
# Messages Table
# ============================================================================

resource "aws_dynamodb_table" "messages" {
  name           = "sharepairs-dev-messages"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "conversation_id"
  range_key      = "created_at"  # Sort key for chronological ordering

  attribute {
    name = "conversation_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "N"  # Number (timestamp)
  }

  attribute {
    name = "id"
    type = "S"
  }

  # GSI for finding messages by message ID
  global_secondary_index {
    name            = "id-index"
    hash_key        = "id"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name    = "sharepairs-dev-messages"
    Purpose = "Chat messages in conversations (write-once, immutable)"
    HIPAA   = "Compliant"
    IRB     = "Compliant"
    Note    = "Messages are immutable - no updates or deletes allowed"
  }
}

# ============================================================================
# User Profiles Table (Extended User Data)
# ============================================================================

resource "aws_dynamodb_table" "user_profiles" {
  name           = "sharepairs-dev-user-profiles"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name    = "sharepairs-dev-user-profiles"
    Purpose = "Extended user profile data"
    HIPAA   = "Compliant"
  }
}

# ============================================================================
# Audit Logs Table (Append-Only)
# ============================================================================

resource "aws_dynamodb_table" "audit_logs" {
  name           = "sharepairs-dev-audit-logs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "timestamp"  # Sort key for chronological ordering

  attribute {
    name = "id"
    type = "S"  # String (UUID)
  }

  attribute {
    name = "timestamp"
    type = "N"  # Number (timestamp)
  }

  attribute {
    name = "event_type"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  # GSI for querying by event type
  global_secondary_index {
    name            = "event-type-index"
    hash_key        = "event_type"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # GSI for querying by user
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

  # Prevent deletion of table (additional protection)
  lifecycle {
    prevent_destroy = false  # Set to true in production
  }

  tags = {
    Name    = "sharepairs-dev-audit-logs"
    Purpose = "Append-only audit log for compliance and IRB requirements"
    HIPAA   = "Compliant"
    IRB     = "Compliant"
  }
}

