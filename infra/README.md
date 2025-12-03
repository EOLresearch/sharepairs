# Share Pairs Infrastructure - IAM Roles

## Quick Start

This directory contains Terraform configuration for creating the minimal IAM roles needed for Share Pairs.

### What's in Here

1. **Lambda Execution Role** - Allows Lambda functions to access RDS, S3, Secrets Manager, and CloudWatch Logs
2. **Cognito Authenticated Role** - Allows logged-in users to upload files to S3 from the frontend

## Prerequisites

- AWS CLI configured (you already did this)
- Terraform installed

### Check Terraform Installation

```bash
terraform version
```

If not installed (macOS):
```bash
brew install terraform
```

## Deploying the Roles

### 1. Initialize Terraform

```bash
cd infra
terraform init
```

This downloads the AWS provider and sets up Terraform.

### 2. Review What Will Be Created

```bash
terraform plan
```

This shows you exactly what resources Terraform will create **without** actually creating them. Review the output carefully!

### 3. Create the Roles

```bash
terraform apply
```

Terraform will ask for confirmation. Type `yes` to proceed.

**Expected output:**
- 2 IAM roles created
- 2 IAM policies attached
- 2 outputs showing the role ARNs (you'll need these later)

### 4. Note the Outputs

After `terraform apply` completes, you'll see outputs like:

```
lambda_execution_role_arn = "arn:aws:iam::114331906101:role/sharepairs-lambda-execution-role"
cognito_authenticated_role_arn = "arn:aws:iam::114331906101:role/sharepairs-cognito-authenticated-role"
```

**Save these ARNs** - you'll need them when:
- Creating Lambda functions (use lambda_execution_role_arn)
- Creating Cognito Identity Pool (use cognito_authenticated_role_arn)

## Understanding the Roles

### Lambda Execution Role

**Who uses it:** Lambda functions
**What it can do:**
- Write logs to CloudWatch (required for Lambda)
- Connect to RDS PostgreSQL database
- Read/write files in S3 buckets starting with `sharepairs-dev-*`
- Get secrets from Secrets Manager (for database passwords)
- Access VPC network resources (if Lambda runs in VPC)

**Permissions are LEAN:**
- Only specific S3 buckets (not all buckets)
- Only specific RDS database users (not all databases)
- Only specific secrets (not all secrets)

### Cognito Authenticated Role

**Who uses it:** Logged-in users in your React app
**What it can do:**
- Upload files to their own folder in S3 (`sharepairs-dev-user-uploads/{user-id}/`)
- Download their own files
- Get their Cognito identity ID

**Permissions are VERY LEAN:**
- Users can ONLY access their own folder (using `${aws:userid}` variable)
- Cannot access other users' files
- Cannot access other S3 buckets

## Important Notes

### ⚠️ Before Creating Cognito

The Cognito Authenticated Role has a placeholder in the `assume_role_policy`:

```terraform
"cognito-identity.amazonaws.com:aud" = "PLACEHOLDER_IDENTITY_POOL_ID"
```

After you create your Cognito Identity Pool, you'll need to:
1. Update this placeholder with the actual Identity Pool ID
2. Run `terraform apply` again to update the role

### 🔒 Security Best Practices

These roles follow **least privilege principle**:
- Lambda can only access YOUR project's resources (not everything)
- Users can only access THEIR OWN files (not other users')
- Resources are scoped to `sharepairs-dev-*` naming convention

### 👥 For Your Volunteers

When your two volunteers start working on backend:
- They'll use the same Lambda execution role
- Each Lambda function will reference this role
- They don't need to create new roles
- All Lambda functions share the same permissions (which is fine for a dev project)

## Troubleshooting

### "Access Denied" errors

1. Check the role ARN is correct when creating Lambda/Cognito
2. Verify the S3 bucket name matches `sharepairs-dev-*` pattern
3. Ensure RDS database user exists and matches the pattern

### Terraform errors

- **"Provider not found"**: Run `terraform init`
- **"Insufficient permissions"**: Check your `sharepairs-admin` user has IAM permissions
- **"Role already exists"**: The role was created manually. Either delete it or import it with `terraform import`

## Next Steps

After creating these roles:

1. **Update Cognito Identity Pool ID** in the role (when you create Cognito)
2. **Use `lambda_execution_role_arn`** when creating Lambda functions
3. **Use `cognito_authenticated_role_arn`** when creating Cognito Identity Pool

## Clean Up (If Needed)

To delete all roles (for testing):
```bash
terraform destroy
```

⚠️ **Warning:** This will delete the roles. Make sure no Lambda functions or Cognito pools are using them first!


