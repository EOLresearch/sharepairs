# ============================================================================
# Lambda Functions for Share Pairs API
# ============================================================================
# 
# LAMBDA EXPLAINED:
# -----------------
# 
# Lambda functions are serverless functions that run your backend code:
# - No servers to manage
# - Pay only for what you use
# - Auto-scales based on traffic
# - Integrates with API Gateway, S3, DynamoDB, etc.
#
# What This Does:
# - Creates Lambda functions for each API endpoint
# - Packages and deploys the code
# - Connects functions to API Gateway routes
# - Sets up environment variables
# - Configures IAM permissions
#
# ============================================================================

# Get Lambda execution role ARN
data "aws_iam_role" "lambda_execution" {
  name = "sharepairs-lambda-execution-role"
}

# ============================================================================
# Lambda Layer for Shared Dependencies
# ============================================================================
# Note: For now, we'll bundle dependencies with each function
# In production, consider using Lambda Layers for shared code

# ============================================================================
# Lambda Function Packaging
# ============================================================================
# 
# NOTE: Before deploying, run: cd backend && ./build.sh
# This will create the zip files needed for Lambda deployment
#
# The build script packages each function with:
# - The function file itself
# - The shared/ directory (database, auth, response, validation utilities)
# - node_modules (production dependencies)
#
# ============================================================================

# ============================================================================
# Auth Lambda Functions
# ============================================================================

resource "aws_lambda_function" "auth_register" {
  filename         = "${path.module}/../backend/functions/auth/register.zip"
  function_name    = "sharepairs-dev-auth-register"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "register.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/auth/register.zip") ? filebase64sha256("${path.module}/../backend/functions/auth/register.zip") : null

  environment {
    variables = {
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.main.id
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.main.id
      USERS_TABLE           = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE   = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE        = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE   = aws_dynamodb_table.user_profiles.name
      AUDIT_LOGS_TABLE      = aws_dynamodb_table.audit_logs.name
      AWS_REGION            = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-auth-register"
    Purpose = "User registration"
  }
}

resource "aws_lambda_function" "auth_login" {
  filename         = "${path.module}/../backend/functions/auth/login.zip"
  function_name    = "sharepairs-dev-auth-login"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "login.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/auth/login.zip") ? filebase64sha256("${path.module}/../backend/functions/auth/login.zip") : null

  environment {
    variables = {
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.main.id
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.main.id
      USERS_TABLE           = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE   = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE        = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE   = aws_dynamodb_table.user_profiles.name
      AUDIT_LOGS_TABLE      = aws_dynamodb_table.audit_logs.name
      AWS_REGION            = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-auth-login"
    Purpose = "User login"
  }
}

resource "aws_lambda_function" "auth_refresh" {
  filename         = "${path.module}/../backend/functions/auth/refresh.zip"
  function_name    = "sharepairs-dev-auth-refresh"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "refresh.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/auth/refresh.zip") ? filebase64sha256("${path.module}/../backend/functions/auth/refresh.zip") : null

  environment {
    variables = {
      COGNITO_CLIENT_ID = aws_cognito_user_pool_client.main.id
      AWS_REGION        = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-auth-refresh"
    Purpose = "Token refresh"
  }
}

resource "aws_lambda_function" "auth_forgot_password" {
  filename         = "${path.module}/../backend/functions/auth/forgot-password.zip"
  function_name    = "sharepairs-dev-auth-forgot-password"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "forgot-password.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/auth/forgot-password.zip") ? filebase64sha256("${path.module}/../backend/functions/auth/forgot-password.zip") : null

  environment {
    variables = {
      COGNITO_CLIENT_ID = aws_cognito_user_pool_client.main.id
      AWS_REGION        = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-auth-forgot-password"
    Purpose = "Password reset request"
  }
}

resource "aws_lambda_function" "auth_reset_password" {
  filename         = "${path.module}/../backend/functions/auth/reset-password.zip"
  function_name    = "sharepairs-dev-auth-reset-password"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "reset-password.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/auth/reset-password.zip") ? filebase64sha256("${path.module}/../backend/functions/auth/reset-password.zip") : null

  environment {
    variables = {
      COGNITO_CLIENT_ID = aws_cognito_user_pool_client.main.id
      AWS_REGION        = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-auth-reset-password"
    Purpose = "Password reset confirmation"
  }
}

# ============================================================================
# Users Lambda Functions
# ============================================================================

resource "aws_lambda_function" "users_get_me" {
  filename         = "${path.module}/../backend/functions/users/get-me.zip"
  function_name    = "sharepairs-dev-users-get-me"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "get-me.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/users/get-me.zip") ? filebase64sha256("${path.module}/../backend/functions/users/get-me.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      USERS_TABLE          = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE  = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE       = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE  = aws_dynamodb_table.user_profiles.name
      AWS_REGION           = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-users-get-me"
    Purpose = "Get current user profile"
  }
}

resource "aws_lambda_function" "users_update_me" {
  filename         = "${path.module}/../backend/functions/users/update-me.zip"
  function_name    = "sharepairs-dev-users-update-me"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "update-me.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/users/update-me.zip") ? filebase64sha256("${path.module}/../backend/functions/users/update-me.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      USERS_TABLE          = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE  = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE       = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE  = aws_dynamodb_table.user_profiles.name
      AWS_REGION           = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-users-update-me"
    Purpose = "Update current user profile"
  }
}

resource "aws_lambda_function" "users_get_by_id" {
  filename         = "${path.module}/../backend/functions/users/get-by-id.zip"
  function_name    = "sharepairs-dev-users-get-by-id"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "get-by-id.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/users/get-by-id.zip") ? filebase64sha256("${path.module}/../backend/functions/users/get-by-id.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      USERS_TABLE          = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE  = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE       = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE  = aws_dynamodb_table.user_profiles.name
      AWS_REGION           = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-users-get-by-id"
    Purpose = "Get user by ID"
  }
}

# ============================================================================
# Messages Lambda Functions
# ============================================================================

resource "aws_lambda_function" "messages_get_conversations" {
  filename         = "${path.module}/../backend/functions/messages/get-conversations.zip"
  function_name    = "sharepairs-dev-messages-get-conversations"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "get-conversations.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/messages/get-conversations.zip") ? filebase64sha256("${path.module}/../backend/functions/messages/get-conversations.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      USERS_TABLE          = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE  = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE       = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE  = aws_dynamodb_table.user_profiles.name
      AWS_REGION           = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-messages-get-conversations"
    Purpose = "Get user conversations"
  }
}

resource "aws_lambda_function" "messages_get_messages" {
  filename         = "${path.module}/../backend/functions/messages/get-messages.zip"
  function_name    = "sharepairs-dev-messages-get-messages"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "get-messages.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/messages/get-messages.zip") ? filebase64sha256("${path.module}/../backend/functions/messages/get-messages.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      USERS_TABLE          = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE  = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE       = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE  = aws_dynamodb_table.user_profiles.name
      AWS_REGION           = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-messages-get-messages"
    Purpose = "Get conversation messages"
  }
}

resource "aws_lambda_function" "messages_send_message" {
  filename         = "${path.module}/../backend/functions/messages/send-message.zip"
  function_name    = "sharepairs-dev-messages-send-message"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "send-message.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/messages/send-message.zip") ? filebase64sha256("${path.module}/../backend/functions/messages/send-message.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      USERS_TABLE          = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE  = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE       = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE  = aws_dynamodb_table.user_profiles.name
      AWS_REGION           = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-messages-send-message"
    Purpose = "Send message"
  }
}

# ============================================================================
# Files Lambda Functions
# ============================================================================

resource "aws_lambda_function" "files_upload" {
  filename         = "${path.module}/../backend/functions/files/upload.zip"
  function_name    = "sharepairs-dev-files-upload"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "upload.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/files/upload.zip") ? filebase64sha256("${path.module}/../backend/functions/files/upload.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.main.id
      USER_UPLOADS_BUCKET   = aws_s3_bucket.user_uploads.id
      AWS_REGION            = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-files-upload"
    Purpose = "Generate file upload URL"
  }
}

resource "aws_lambda_function" "files_get" {
  filename         = "${path.module}/../backend/functions/files/get.zip"
  function_name    = "sharepairs-dev-files-get"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "get.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/files/get.zip") ? filebase64sha256("${path.module}/../backend/functions/files/get.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.main.id
      USER_UPLOADS_BUCKET   = aws_s3_bucket.user_uploads.id
      AWS_REGION            = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-files-get"
    Purpose = "Generate file download URL"
  }
}

resource "aws_lambda_function" "files_delete" {
  filename         = "${path.module}/../backend/functions/files/delete.zip"
  function_name    = "sharepairs-dev-files-delete"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "delete.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/files/delete.zip") ? filebase64sha256("${path.module}/../backend/functions/files/delete.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.main.id
      USER_UPLOADS_BUCKET   = aws_s3_bucket.user_uploads.id
      AWS_REGION            = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-files-delete"
    Purpose = "Delete file"
  }
}

# ============================================================================
# Distress Lambda Function
# ============================================================================

resource "aws_lambda_function" "distress_send_alert" {
  filename         = "${path.module}/../backend/functions/distress/send-alert.zip"
  function_name    = "sharepairs-dev-distress-send-alert"
  role            = data.aws_iam_role.lambda_execution.arn
  handler         = "send-alert.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  source_code_hash = fileexists("${path.module}/../backend/functions/distress/send-alert.zip") ? filebase64sha256("${path.module}/../backend/functions/distress/send-alert.zip") : null

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      USERS_TABLE          = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE  = aws_dynamodb_table.conversations.name
      MESSAGES_TABLE       = aws_dynamodb_table.messages.name
      USER_PROFILES_TABLE  = aws_dynamodb_table.user_profiles.name
      AWS_REGION           = "us-east-1"
    }
  }

  tags = {
    Name    = "sharepairs-dev-distress-send-alert"
    Purpose = "Send distress alert (admin)"
  }
}

