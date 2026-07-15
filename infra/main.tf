# ============================================================================
# Share Pairs AWS Infrastructure
# ============================================================================
# 
# Terraform Configuration for Share Pairs migration to AWS
# 
# This file sets up the Terraform provider and configuration.
# See other .tf files for specific resource definitions.
#
# ============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "sharepairs"
      Environment = "dev"
      ManagedBy   = "Terraform"
    }
  }
}

# IAM CreateRole rejects tags without iam:TagRole; radiology-admin-role lacks that permission.
provider "aws" {
  alias  = "no_default_tags"
  region = "us-east-1"
}
