variable "enable_auditing" {
  description = "Create CloudTrail and AWS Config (requires iam:CreateRole for audit roles)"
  type        = bool
  default     = false
}
