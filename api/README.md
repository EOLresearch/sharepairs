# Share Pairs API Documentation

This directory contains the OpenAPI 3.0 specification for the Share Pairs REST API.

## Files

- `openapi.yaml` - Complete API specification in OpenAPI 3.0 format

## Viewing the API Documentation

### Option 1: Swagger UI (Recommended)
1. Go to https://editor.swagger.io/
2. Click "File" → "Import file"
3. Upload `openapi.yaml`
4. View interactive API documentation

### Option 2: Redoc
1. Install Redoc CLI: `npm install -g redoc-cli`
2. Run: `redoc-cli serve api/openapi.yaml`
3. Open http://localhost:8080 in your browser

### Option 3: Postman
1. Open Postman
2. Click "Import"
3. Select "File" → Choose `openapi.yaml`
4. Postman will generate a collection with all endpoints

## API Overview

### Base URL
```
https://{api-id}.execute-api.us-east-1.amazonaws.com/prod
```

Replace `{api-id}` with your API Gateway ID (from Terraform output: `terraform output api_gateway_id`)

### Authentication

All endpoints (except `/auth/*`) require a Cognito JWT token:

```
Authorization: Bearer {cognito-id-token}
```

### Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with code

#### Users
- `GET /users/me` - Get current user profile
- `PUT /users/me` - Update current user profile
- `GET /users/{userId}` - Get user by ID
- `GET /users/matches` - Get matched users

#### Conversations
- `GET /conversations` - List user's conversations
- `POST /conversations` - Create new conversation (admin)
- `GET /conversations/{id}` - Get conversation details
- `GET /conversations/{id}/messages` - Get messages
- `POST /conversations/{id}/messages` - Send message

#### Admin
- `GET /admin/users` - List all users
- `GET /admin/users/{id}` - Get user details
- `PUT /admin/users/{id}` - Update user
- `GET /admin/conversations` - List all conversations
- `POST /admin/distress-alert` - Send distress alert

## Using with Terraform

The OpenAPI spec can be used to:
1. Generate API Gateway routes automatically
2. Generate client SDKs for frontend
3. Generate server stubs for Lambda functions
4. Validate API requests/responses

## Next Steps

1. Review and adjust the API spec as needed
2. Generate Lambda function stubs from the spec
3. Implement the endpoints in Lambda
4. Connect API Gateway routes to Lambda functions
5. Generate TypeScript client for frontend

## Tools

- **Swagger Editor**: https://editor.swagger.io/
- **Redoc**: https://github.com/Redocly/redoc
- **Postman**: https://www.postman.com/
- **OpenAPI Generator**: https://openapi-generator.tech/



