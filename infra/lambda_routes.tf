# ============================================================================
# API Gateway Routes for Lambda Functions
# ============================================================================

# ============================================================================
# File Upload URL Route
# ============================================================================

resource "aws_apigatewayv2_route" "upload_url" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /files/upload-url"

  target = "integrations/${aws_apigatewayv2_integration.upload_url.id}"
}

resource "aws_apigatewayv2_integration" "upload_url" {
  api_id = aws_apigatewayv2_api.main.id

  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.upload_url.invoke_arn
}

# Lambda permission for API Gateway to invoke upload-url function
resource "aws_lambda_permission" "upload_url" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================================================
# File Download URL Route
# ============================================================================

resource "aws_apigatewayv2_route" "download_url" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /files/{fileId}/download-url"

  target = "integrations/${aws_apigatewayv2_integration.download_url.id}"
}

resource "aws_apigatewayv2_integration" "download_url" {
  api_id = aws_apigatewayv2_api.main.id

  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.download_url.invoke_arn
}

# Lambda permission for API Gateway to invoke download-url function
resource "aws_lambda_permission" "download_url" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.download_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================================================
# Distress Alert Route
# ============================================================================

resource "aws_apigatewayv2_route" "distress_submit" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /distress"

  target = "integrations/${aws_apigatewayv2_integration.distress_submit.id}"
}

resource "aws_apigatewayv2_integration" "distress_submit" {
  api_id = aws_apigatewayv2_api.main.id

  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.distress_submit.invoke_arn
}

# Lambda permission for API Gateway to invoke distress-submit function
resource "aws_lambda_permission" "distress_submit" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.distress_submit.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

