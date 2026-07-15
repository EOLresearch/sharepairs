variable "enable_auditing" {
  description = "Create CloudTrail and AWS Config (requires iam:CreateRole for audit roles)"
  type        = bool
  default     = false
}

variable "lambda_execution_role_arn" {
  description = "ITS-provided Lambda execution role ARN (no iam:GetRole lookup needed)"
  type        = string
  default     = "arn:aws:iam::562395967936:role/webdev-lambda-role"
}

variable "attach_lambda_custom_policy" {
  description = "Attach inline policy to webdev-lambda-role (false if ITS already attached permissions)"
  type        = bool
  default     = false
}

variable "attach_cognito_authenticated_role" {
  description = "Attach Cognito identity pool to authenticated IAM role (requires iam:PassRole on that role ARN)"
  type        = bool
  default     = false
}
