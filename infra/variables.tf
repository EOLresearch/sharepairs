variable "enable_auditing" {
  description = "Create CloudTrail and AWS Config (requires iam:CreateRole for audit roles)"
  type        = bool
  default     = false
}

variable "lambda_execution_role_name" {
  description = "ITS-provided Lambda execution role (do not create via Terraform)"
  type        = string
  default     = "webdev-lambda-role"
}
