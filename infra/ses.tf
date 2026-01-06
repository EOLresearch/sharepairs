# ============================================================================
# Amazon SES Configuration for Email Notifications
# ============================================================================
# 
# SES EXPLAINED:
# --------------
# 
# Amazon SES (Simple Email Service) sends transactional emails:
# - Distress alerts to support team
# - Password resets, notifications, etc.
# 
# For production, you need to:
# 1. Verify sender email/domain (required to send emails)
# 2. Move out of SES sandbox (required to send to unverified emails)
# 
# For development:
# - SES sandbox mode allows sending to verified emails only
# - You can verify test email addresses in AWS Console
#
# ============================================================================

# SES Configuration Set (optional - for tracking bounces, complaints, etc.)
resource "aws_ses_configuration_set" "distress_alerts" {
  name = "sharepairs-dev-distress-alerts"

  # Delivery options (optional)
  delivery_options {
    tls_policy = "Require" # Require TLS for email delivery
  }

  tags = {
    Name    = "sharepairs-dev-distress-alerts"
    Purpose = "SES configuration for distress alert emails"
  }
}

# Note: Email/domain verification must be done manually in AWS Console
# or via AWS CLI. Terraform doesn't support email verification directly.
# 
# To verify an email:
# aws ses verify-email-identity --email-address support@yourdomain.com
#
# To verify a domain:
# aws ses verify-domain-identity --domain yourdomain.com
# Then add the TXT record to your DNS

