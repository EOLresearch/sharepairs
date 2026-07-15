locals {
  account_id       = data.aws_caller_identity.current.account_id
  s3_frontend      = "sharepairs-dev-${local.account_id}-frontend"
  s3_user_uploads  = "sharepairs-dev-${local.account_id}-user-uploads"
  s3_logs          = "sharepairs-dev-${local.account_id}-logs"
  cognito_domain   = "sharepairs-${local.account_id}-auth"
  # CloudShell has ~1GB home; keep Lambda zip artifacts in /tmp.
  lambda_zip_dir   = "/tmp/sharepairs-lambda-zips"
}
