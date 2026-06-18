# ============================================================================
# API Gateway WebSocket API — realtime messaging push
# ============================================================================

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "sharepairs-dev-websocket"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = {
    Name    = "sharepairs-dev-websocket"
    Purpose = "Realtime message and conversation push"
    HIPAA   = "Compliant"
  }
}

resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "prod"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }

  tags = {
    Name = "sharepairs-dev-websocket-prod"
  }
}

# ============================================================================
# WebSocket Lambda
# ============================================================================

data "archive_file" "websocket" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/../backend/functions/websocket/websocket.zip"
  excludes = [
    "*.zip",
    ".build/**",
    "functions/**/upload-url.js",
    "functions/**/download-url.js",
    "functions/**/submit.js",
    "functions/**/worker.js",
    "functions/api/**",
    "functions/auth/**",
    "functions/files/**",
    "functions/distress/**",
    "local-server.mjs",
    "package-lock.json"
  ]
}

resource "aws_lambda_function" "websocket" {
  function_name = "sharepairs-dev-websocket"
  role          = data.aws_iam_role.lambda_execution.arn
  handler       = "functions/websocket/index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.websocket.output_path
  source_code_hash = data.archive_file.websocket.output_base64sha256

  environment {
    variables = {
      STUB_AUTH              = "false"
      USERS_TABLE            = "sharepairs-dev-users"
      CONVERSATIONS_TABLE    = "sharepairs-dev-conversations"
      MESSAGES_TABLE         = "sharepairs-dev-messages"
      CONNECTIONS_TABLE      = aws_dynamodb_table.connections.name
      WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}"
      CORS_ORIGIN            = "https://${aws_cloudfront_distribution.frontend.domain_name}"
    }
  }

  tags = {
    Name    = "sharepairs-dev-websocket"
    Purpose = "WebSocket connect/disconnect/message routes"
  }
}

resource "aws_apigatewayv2_integration" "websocket" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.websocket.invoke_arn
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.websocket.id}"
}

resource "aws_lambda_permission" "websocket" {
  statement_id  = "AllowExecutionFromWebSocketAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
}
