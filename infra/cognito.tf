# ============================================================================
# AWS Cognito Configuration
# ============================================================================
# 
# COGNITO EXPLAINED:
# ------------------
# 
# Cognito has two main components:
# 1. User Pool - Handles user authentication (sign up, sign in, password reset)
# 2. Identity Pool - Maps authenticated users to AWS IAM roles (for S3 access, etc.)
#
# User Pool:
# - Stores user accounts (email, password, attributes)
# - Handles authentication flows (login, registration, password reset)
# - Issues JWT tokens (access token, ID token, refresh token)
# - HIPAA compliant when configured properly
#
# Identity Pool:
# - Maps Cognito users to AWS IAM roles
# - Allows authenticated users to access AWS services (S3, etc.)
# - Provides temporary AWS credentials
#
# ============================================================================

# ============================================================================
# Cognito User Pool
# ============================================================================
# 
# This is where user accounts are stored and authentication happens
#
# ============================================================================

resource "aws_cognito_user_pool" "main" {
  name = "sharepairs-dev-user-pool"

  # Password policy (HIPAA compliant - strong passwords)
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
    temporary_password_validity_days = 7
  }

  # Account recovery settings
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration (using Cognito's default email service)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
    # Note: For production, you might want to use SES for better deliverability
  }

  # User pool attributes
  # Users sign in with email (username_attributes makes email the username)
  auto_verified_attributes = ["email"]
  username_attributes = ["email"]

  # Custom attributes for user profiles
  schema {
    attribute_data_type = "String"
    name                = "display_name"
    required            = false
    mutable             = true
  }

  schema {
    attribute_data_type = "String"
    name                = "preferred_language"
    required            = false
    mutable             = true
  }

  schema {
    attribute_data_type = "String"
    name                = "timezone"
    required            = false
    mutable             = true
  }

  schema {
    attribute_data_type = "Boolean"
    name                = "is_admin"
    required            = false
    mutable             = true
  }

  # User pool configuration
  admin_create_user_config {
    allow_admin_create_user_only = false  # Users can self-register
    invite_message_template {
      email_subject = "Welcome to Share Pairs"
      email_message = "Your username is {username} and temporary password is {####}"
      sms_message   = "Your username is {username} and temporary password is {####}"
    }
  }

  # Device tracking (for security)
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  # MFA configuration (optional - can enable later)
  mfa_configuration = "OFF"

  # User pool tags
  tags = {
    Name        = "sharepairs-dev-user-pool"
    Description = "User Pool for Share Pairs authentication"
    Environment = "dev"
    Project     = "sharepairs"
  }
}

# ============================================================================
# Cognito User Pool Client
# ============================================================================
# 
# This is the application client that your frontend/backend uses to
# authenticate users with the User Pool
#
# ============================================================================

resource "aws_cognito_user_pool_client" "main" {
  name         = "sharepairs-dev-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # Client configuration
  generate_secret                      = false  # Public client (frontend can't keep secrets)
  prevent_user_existence_errors       = "ENABLED"  # Don't reveal if user exists
  enable_token_revocation              = true  # Allow token revocation
  enable_propagate_additional_user_context_data = false

  # Token validity periods
  access_token_validity  = 60   # 1 hour (in minutes)
  id_token_validity      = 60   # 1 hour (in minutes)
  refresh_token_validity = 30   # 30 days (in days)
  
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Authentication flows
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",        # Secure Remote Password (recommended)
    "ALLOW_REFRESH_TOKEN_AUTH",   # Token refresh
    "ALLOW_USER_PASSWORD_AUTH"    # Direct password auth (for backend)
  ]

  # OAuth configuration (if needed later)
  supported_identity_providers = ["COGNITO"]
  
  # Callback URLs (update these with your actual domain)
  callback_urls = [
    "http://localhost:3000/callback",
    "http://localhost:3000"  # For development
    # Add production URLs later: "https://your-domain.com/callback"
  ]
  
  logout_urls = [
    "http://localhost:3000/logout",
    "http://localhost:3000"  # For development
    # Add production URLs later: "https://your-domain.com/logout"
  ]

  # OAuth scopes
  allowed_oauth_flows = ["code", "implicit"]
  allowed_oauth_scopes = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "custom:display_name",
    "custom:preferred_language",
    "custom:timezone",
    "custom:is_admin"
  ]

  write_attributes = [
    "email",
    "custom:display_name",
    "custom:preferred_language",
    "custom:timezone"
  ]
}

# ============================================================================
# Cognito User Pool Domain
# ============================================================================
# 
# This provides a hosted UI for authentication (optional but useful)
# Users can sign in at: https://<domain>.auth.<region>.amazoncognito.com
#
# ============================================================================

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "sharepairs-dev-auth"
  user_pool_id = aws_cognito_user_pool.main.id
}

# ============================================================================
# Cognito Identity Pool
# ============================================================================
# 
# This maps authenticated Cognito users to AWS IAM roles
# Allows users to access AWS services (like S3) from the frontend
#
# ============================================================================

resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "sharepairs-dev-identity-pool"
  allow_unauthenticated_identities = false  # Only authenticated users

  # Authentication providers (link to User Pool)
  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = true  # Validate tokens server-side
  }

  tags = {
    Name        = "sharepairs-dev-identity-pool"
    Description = "Identity Pool for Share Pairs AWS resource access"
    Environment = "dev"
    Project     = "sharepairs"
  }
}

# ============================================================================
# Cognito Identity Pool Roles Attachment
# ============================================================================
# 
# This attaches IAM roles to the Identity Pool
# Separate resource because roles configuration changed in newer AWS provider
#
# ============================================================================

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated = aws_iam_role.cognito_authenticated.arn
  }
}

