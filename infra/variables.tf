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
