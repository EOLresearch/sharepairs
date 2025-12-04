# ============================================================================
# CloudFront Distribution - Frontend CDN with TLS Enforcement
# ============================================================================
# 
# CLOUDFRONT EXPLAINED:
# ---------------------
# 
# CloudFront is AWS's Content Delivery Network (CDN):
# - Serves your React app from edge locations worldwide (fast loading)
# - Enforces HTTPS/TLS for all traffic
# - Automatically redirects HTTP to HTTPS
# - Uses free SSL certificates from AWS Certificate Manager (ACM)
# - Essential for HIPAA compliance (encrypted data in transit)
#
# What This Does:
# - Creates a CloudFront distribution pointing to your S3 bucket
# - Forces all traffic to use HTTPS (TLS 1.2+)
# - Blocks insecure HTTP connections
# - Provides a CDN URL (like: https://d1234abcd.cloudfront.net)
#
# ============================================================================

# ============================================================================
# S3 Bucket for Frontend Static Site
# ============================================================================

resource "aws_s3_bucket" "frontend" {
  bucket = "sharepairs-dev-frontend" # Must be globally unique

  tags = {
    Name    = "sharepairs-dev-frontend"
    Purpose = "React app static site hosting"
    HIPAA   = "Compliant"
  }
}

# Block all public access (CloudFront will access via Origin Access Control)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for frontend deployments
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption with KMS (use existing S3 KMS key)
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
  }
}

# S3 bucket policy will be created after CloudFront distribution (below)

# ============================================================================
# CloudFront Origin Access Control (OAC)
# ============================================================================
# OAC allows CloudFront to access the private S3 bucket

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "sharepairs-dev-frontend-oac"
  description                       = "OAC for sharepairs frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 bucket policy - TLS enforcement + CloudFront access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  depends_on = [aws_cloudfront_distribution.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          "${aws_s3_bucket.frontend.arn}/*",
          aws_s3_bucket.frontend.arn
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# ============================================================================
# CloudFront Distribution
# ============================================================================

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "Share Pairs frontend - HIPAA compliant with TLS enforcement"

  # S3 bucket as origin
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Default cache behavior - enforce HTTPS
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

    # TLS ENFORCEMENT: Redirect HTTP to HTTPS
    viewer_protocol_policy = "redirect-to-https"

    # Use managed cache policy (simplified caching)
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    
    # Security headers for HIPAA compliance
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    compress = true
  }

  # Error pages - redirect 404s to index.html for React Router
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Price class - use all edge locations (or use "PriceClass_100" for cheapest)
  price_class = "PriceClass_All"

  # Restrictions - none (public access via HTTPS)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Viewer certificate - use CloudFront default certificate (free)
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }

  tags = {
    Name        = "sharepairs-dev-frontend"
    Purpose     = "Frontend CDN with TLS enforcement"
    HIPAA       = "Compliant"
  }
}

# ============================================================================
# CloudFront Response Headers Policy - Security Headers
# ============================================================================
# Additional security headers for HIPAA compliance

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "sharepairs-dev-security-headers"
  comment = "Security headers for HIPAA compliance"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000 # 1 year
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
      override                = true
    }
  }
}

