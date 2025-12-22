# Share Pairs Backend API

Lambda functions for the Share Pairs REST API.

## Structure

```
backend/
├── functions/
│   ├── auth/          # Authentication endpoints
│   ├── users/         # User management endpoints
│   ├── messages/      # Chat/messaging endpoints
│   ├── files/         # File upload/download endpoints
│   └── distress/      # Distress alert endpoint (admin)
├── shared/            # Shared utilities
│   ├── database.js    # DynamoDB connection
│   ├── auth.js        # Cognito authentication
│   ├── response.js    # Standardized responses
│   └── validation.js  # Request validation
└── package.json       # Dependencies
```

## Functions

### Auth
- `register.js` - Register new user
- `login.js` - Login user
- `refresh.js` - Refresh access token
- `forgot-password.js` - Request password reset
- `reset-password.js` - Reset password with code

### Users
- `get-me.js` - Get current user profile
- `update-me.js` - Update current user profile
- `get-by-id.js` - Get user by ID (public)

### Messages
- `get-conversations.js` - List user's conversations
- `get-messages.js` - Get messages for a conversation
- `send-message.js` - Send a message

### Files
- `upload.js` - Generate presigned URL for upload
- `get.js` - Generate presigned URL for download
- `delete.js` - Delete a file

### Distress
- `send-alert.js` - Send distress alert (admin only)

## Environment Variables

Required for all functions:
- `COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `COGNITO_CLIENT_ID` - Cognito App Client ID
- `AWS_REGION` - AWS region (default: us-east-1)

Required for database functions:
- `USERS_TABLE` - DynamoDB users table name
- `CONVERSATIONS_TABLE` - DynamoDB conversations table name
- `MESSAGES_TABLE` - DynamoDB messages table name
- `USER_PROFILES_TABLE` - DynamoDB user profiles table name

Required for file functions:
- `USER_UPLOADS_BUCKET` - S3 bucket for user uploads

## Deployment

### Option 1: Manual ZIP Deployment

1. Install dependencies:
```bash
cd backend
npm install
```

2. Package each function:
```bash
# Example for auth/register
cd functions/auth
zip -r register.zip register.js ../../shared
```

3. Deploy via Terraform (once lambda.tf is configured)

### Option 2: AWS CLI Deployment

```bash
# Package function
cd functions/auth
zip -r register.zip register.js ../../shared node_modules

# Deploy
aws lambda update-function-code \
  --function-name sharepairs-dev-auth-register \
  --zip-file fileb://register.zip
```

### Option 3: Terraform with Archive Provider (Recommended)

Use Terraform's `archive_file` data source to automatically package functions.

## Next Steps

1. Deploy DynamoDB tables via Terraform (`terraform apply` in `infra/` directory)
2. Package Lambda functions (`./build.sh`)
3. Deploy Lambda functions and API Gateway routes via Terraform
4. Test endpoints

## Testing

Functions can be tested locally using AWS SAM or by invoking them directly:

```bash
# Test register function
node -e "
const handler = require('./functions/auth/register').handler;
handler({
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test123!',
    displayName: 'Test User'
  })
}).then(console.log);
"
```

