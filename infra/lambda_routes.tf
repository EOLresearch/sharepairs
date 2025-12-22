# ============================================================================
# API Gateway Routes - Connect Lambda Functions to API Endpoints
# ============================================================================
# 
# This file connects Lambda functions to API Gateway routes
# Each route maps an HTTP method + path to a Lambda function
#
# ============================================================================

# ============================================================================
# Auth Routes
# ============================================================================

resource "aws_apigatewayv2_route" "auth_register" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/register"
  target    = "integrations/${aws_apigatewayv2_integration.auth_register.id}"
}

resource "aws_apigatewayv2_integration" "auth_register" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.auth_register.invoke_arn
}

resource "aws_lambda_permission" "auth_register" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_register.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "auth_login" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/login"
  target    = "integrations/${aws_apigatewayv2_integration.auth_login.id}"
}

resource "aws_apigatewayv2_integration" "auth_login" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.auth_login.invoke_arn
}

resource "aws_lambda_permission" "auth_login" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_login.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "auth_refresh" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/refresh"
  target    = "integrations/${aws_apigatewayv2_integration.auth_refresh.id}"
}

resource "aws_apigatewayv2_integration" "auth_refresh" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.auth_refresh.invoke_arn
}

resource "aws_lambda_permission" "auth_refresh" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_refresh.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "auth_forgot_password" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/forgot-password"
  target    = "integrations/${aws_apigatewayv2_integration.auth_forgot_password.id}"
}

resource "aws_apigatewayv2_integration" "auth_forgot_password" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.auth_forgot_password.invoke_arn
}

resource "aws_lambda_permission" "auth_forgot_password" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_forgot_password.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "auth_reset_password" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/reset-password"
  target    = "integrations/${aws_apigatewayv2_integration.auth_reset_password.id}"
}

resource "aws_apigatewayv2_integration" "auth_reset_password" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.auth_reset_password.invoke_arn
}

resource "aws_lambda_permission" "auth_reset_password" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_reset_password.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================================================
# Users Routes
# ============================================================================

resource "aws_apigatewayv2_route" "users_get_me" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /users/me"
  target    = "integrations/${aws_apigatewayv2_integration.users_get_me.id}"
}

resource "aws_apigatewayv2_integration" "users_get_me" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.users_get_me.invoke_arn
}

resource "aws_lambda_permission" "users_get_me" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users_get_me.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "users_update_me" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /users/me"
  target    = "integrations/${aws_apigatewayv2_integration.users_update_me.id}"
}

resource "aws_apigatewayv2_integration" "users_update_me" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.users_update_me.invoke_arn
}

resource "aws_lambda_permission" "users_update_me" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users_update_me.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "users_get_by_id" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /users/{userId}"
  target    = "integrations/${aws_apigatewayv2_integration.users_get_by_id.id}"
}

resource "aws_apigatewayv2_integration" "users_get_by_id" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.users_get_by_id.invoke_arn
}

resource "aws_lambda_permission" "users_get_by_id" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users_get_by_id.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================================================
# Messages Routes
# ============================================================================

resource "aws_apigatewayv2_route" "messages_get_conversations" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /conversations"
  target    = "integrations/${aws_apigatewayv2_integration.messages_get_conversations.id}"
}

resource "aws_apigatewayv2_integration" "messages_get_conversations" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.messages_get_conversations.invoke_arn
}

resource "aws_lambda_permission" "messages_get_conversations" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.messages_get_conversations.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "messages_get_messages" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /conversations/{conversationId}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.messages_get_messages.id}"
}

resource "aws_apigatewayv2_integration" "messages_get_messages" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.messages_get_messages.invoke_arn
}

resource "aws_lambda_permission" "messages_get_messages" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.messages_get_messages.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "messages_send_message" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /conversations/{conversationId}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.messages_send_message.id}"
}

resource "aws_apigatewayv2_integration" "messages_send_message" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.messages_send_message.invoke_arn
}

resource "aws_lambda_permission" "messages_send_message" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.messages_send_message.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================================================
# Files Routes
# ============================================================================

resource "aws_apigatewayv2_route" "files_upload" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /files/upload"
  target    = "integrations/${aws_apigatewayv2_integration.files_upload.id}"
}

resource "aws_apigatewayv2_integration" "files_upload" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.files_upload.invoke_arn
}

resource "aws_lambda_permission" "files_upload" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.files_upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "files_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /files/{fileKey}"
  target    = "integrations/${aws_apigatewayv2_integration.files_get.id}"
}

resource "aws_apigatewayv2_integration" "files_get" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.files_get.invoke_arn
}

resource "aws_lambda_permission" "files_get" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.files_get.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "files_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /files/{fileKey}"
  target    = "integrations/${aws_apigatewayv2_integration.files_delete.id}"
}

resource "aws_apigatewayv2_integration" "files_delete" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.files_delete.invoke_arn
}

resource "aws_lambda_permission" "files_delete" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.files_delete.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================================================
# Distress Routes
# ============================================================================

resource "aws_apigatewayv2_route" "distress_send_alert" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /admin/distress-alert"
  target    = "integrations/${aws_apigatewayv2_integration.distress_send_alert.id}"
}

resource "aws_apigatewayv2_integration" "distress_send_alert" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.distress_send_alert.invoke_arn
}

resource "aws_lambda_permission" "distress_send_alert" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.distress_send_alert.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

