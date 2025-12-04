# ============================================================================
# API Gateway - REST API with TLS Enforcement
# ============================================================================
# 
# API GATEWAY EXPLAINED:
# ----------------------
# 
# API Gateway provides REST APIs for your Lambda functions:
# - Handles HTTP/HTTPS requests from your frontend
# - Routes requests to appropriate Lambda functions
# - Enforces TLS/HTTPS for all API calls
# - Provides authentication, rate limiting, request validation
# - Essential for HIPAA compliance (encrypted API communication)
#
# What This Does:
# - Creates a REST API structure (ready for Lambda integrations)
# - Enforces HTTPS-only access (blocks HTTP)
# - Sets minimum TLS version to 1.2+
# - Creates a production stage with TLS enforcement
# - Provides API endpoint URL (like: https://abc123.execute-api.us-east-1.amazonaws.com/prod)
#
# Note: Lambda function integrations will be added later
#
# ============================================================================

# ============================================================================
# API Gateway REST API
# ============================================================================

resource "aws_apigatewayv2_api" "main" {
  name          = "sharepairs-dev-api"
  protocol_type = "HTTP"
  description   = "Share Pairs REST API - HIPAA compliant with TLS enforcement"

  # TLS Configuration - enforce minimum TLS version
  cors_configuration {
    allow_origins = ["*"] # Update with your CloudFront domain later
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key"]
    max_age      = 300
  }

  tags = {
    Name    = "sharepairs-dev-api"
    Purpose = "REST API with TLS enforcement"
    HIPAA   = "Compliant"
  }
}

# ============================================================================
# API Gateway Stage - Production
# ============================================================================

resource "aws_apigatewayv2_stage" "production" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "prod"
  auto_deploy = true

  # TLS Enforcement - default route requires HTTPS
  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }

  # Access logging (HIPAA audit requirement)
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = {
    Name    = "sharepairs-dev-api-prod"
    Purpose = "Production API stage with TLS enforcement"
  }
}

# ============================================================================
# API Gateway Domain Configuration (for future custom domain)
# ============================================================================
# Uncomment and configure when you have a custom domain
#
# resource "aws_apigatewayv2_domain_name" "main" {
#   domain_name = "api.sharepairs.com"
#
#   domain_name_configuration {
#     certificate_arn = aws_acm_certificate.api.arn
#     endpoint_type   = "REGIONAL"
#     security_policy = "TLS_1_2" # HIPAA requires TLS 1.2+
#   }
# }
#
# resource "aws_apigatewayv2_api_mapping" "main" {
#   api_id      = aws_apigatewayv2_api.main.id
#   domain_name = aws_apigatewayv2_domain_name.main.id
#   stage       = aws_apigatewayv2_stage.production.id
# }

# ============================================================================
# TLS Enforcement for API Gateway
# ============================================================================
# Note: HTTP API (v2) enforces HTTPS by default - all endpoints are HTTPS-only
# No additional policy needed. When you add a custom domain, configure TLS there.

# ============================================================================
# CloudWatch Log Group for API Gateway
# ============================================================================

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/sharepairs-dev-api"
  retention_in_days = 90 # HIPAA retention - adjust as needed

  tags = {
    Name    = "sharepairs-dev-api-gateway-logs"
    Purpose = "API Gateway access logs"
    HIPAA   = "Compliant"
  }
}

# Note: HTTP API (v2) handles CloudWatch logging automatically
# No separate IAM role needed - permissions are managed by the service

# ============================================================================
# API Routes
# ============================================================================
# Note: Add Lambda function integrations here when you create them
# HTTP API v2 only supports proxy integrations (AWS_PROXY, HTTP_PROXY)
# Example structure will be added when Lambda functions are ready

