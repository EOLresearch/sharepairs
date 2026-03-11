# AWS Backend — Deploy Instructions

Minimal HIPAA-minded backend: API Gateway + Lambda + DynamoDB. Auth: stub (dev) or Cognito (prod).

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node 18+
- (Optional) AWS SAM CLI for one-command deploy

## 1. DynamoDB tables

Create tables (or use seed script which creates them):

```bash
cd backend
export STAGE=dev
export AWS_REGION=us-east-1

# Create tables and seed dev data (optional)
node scripts/seed.js
```

Or create manually in AWS Console / CLI. See `infra/SCHEMA.md` for attribute and key definitions.

- **users**: PK `id` (S), GSI `email-index` PK `email` (S)
- **conversations**: PK `id` (S)
- **messages**: PK `conversation_id` (S), SK `message_id` (S)

## 2. Lambda

Package and deploy the API Lambda:

```bash
cd backend
npm install
zip -r api.zip functions/api shared node_modules package.json
```

Create Lambda in AWS:

- **Name**: e.g. `sharepairs-api`
- **Runtime**: Node.js 18.x
- **Handler**: `functions/api/index.handler`
- **Environment variables**:
  - `USERS_TABLE` = your users table name
  - `CONVERSATIONS_TABLE` = your conversations table name
  - `MESSAGES_TABLE` = your messages table name
  - `STUB_AUTH` = `true` (for dev) or omit for Cognito
  - `STUB_AUTH_SECRET` = random string (dev only)
  - `CORS_ORIGIN` = your frontend origin or `*` for dev

Upload `api.zip` as the function code. Set timeout to 30 s and memory to 256 MB.

## 3. API Gateway

Create an HTTP API (API Gateway v2):

1. Create API → HTTP API → Next.
2. Add integration: Lambda, select your `sharepairs-api` Lambda.
3. Add routes:
   - `POST /api/auth/login` → Lambda
   - `GET /api/auth/me` → Lambda
   - `PATCH /api/auth/me` → Lambda
   - `GET /api/matches` → Lambda
   - `GET /api/messages` → Lambda
   - `POST /api/messages/send` → Lambda
   - `POST /api/messages/seen` → Lambda
   - `POST /api/consent/request` → Lambda
   - `POST /api/consent/respond` → Lambda
   - `GET /api/conversations` → Lambda
   - `POST /api/conversations` → Lambda
4. Optional: `ANY /api/{proxy+}` → same Lambda (simplifies routing).
5. Create stage (e.g. `dev`). Note the invoke URL.

## 4. CORS

If you use a custom domain or need specific origins, set `CORS_ORIGIN` on the Lambda. The Lambda response already includes `Access-Control-Allow-*` headers. For OPTIONS, the router returns 204 with CORS headers.

## 5. Local dev (optional)

- **DynamoDB Local**: Run DynamoDB Local, set `DYNAMODB_ENDPOINT=http://localhost:8000`, then `node scripts/seed.js`.
- **Stub auth**: Set `STUB_AUTH=true` and `STUB_AUTH_SECRET=dev` in env. Login with seeded user (e.g. `user1@example.com` / `password123`).
- **Proxy**: In the React app, set `"proxy": "https://YOUR_API_URL"` in package.json so `/api/*` is forwarded to API Gateway, and use the same origin so cookies are sent.

## 6. Frontend

Point the React app at your API:

- Dev: use a proxy in `package.json`: `"proxy": "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com"` or set `REACT_APP_API_URL`.
- Or run a local Express that proxies to Lambda (see “Local dev” below).

## 7. Stub auth (dev)

With `STUB_AUTH=true`:

1. Run seed: `node scripts/seed.js`
2. POST `/api/auth/login` with `{ "email": "user1@example.com", "password": "password123" }`
3. Response includes `token` and `Set-Cookie`. Use `Authorization: Bearer <token>` or cookie for subsequent requests.

## 8. Cognito (production)

- Create User Pool; configure app client.
- Replace stub login in `handlers/auth.js` with Cognito `InitiateAuth` (USER_PASSWORD_AUTH) or Hosted UI.
- In `auth.js`, verify JWT using Cognito JWKS (e.g. `jose` or `jsonwebtoken` with JWKS endpoint). Keep `authenticateUser(event)` resolving `userId` from `decoded.sub`.
- Set `STUB_AUTH` to false or omit.

## API route mapping (summary)

| Method | Path                    | Handler              |
|--------|-------------------------|----------------------|
| POST   | /api/auth/login        | auth.login           |
| GET    | /api/auth/me           | auth.me              |
| PATCH  | /api/auth/me           | auth.mePatch         |
| GET    | /api/matches           | matches.getMatches   |
| GET    | /api/messages          | messages.getMessages |
| POST   | /api/messages/send     | messages.sendMessage |
| POST   | /api/messages/seen     | messages.markSeen    |
| POST   | /api/consent/request   | consent.consentRequest |
| POST   | /api/consent/respond   | consent.consentRespond |
| GET    | /api/conversations     | conversations.listConversations |
| POST   | /api/conversations     | conversations.createConversation |

## What is still stubbed

- **Cognito**: Login in production returns 501; integrate InitiateAuth + JWT verification.
- **Register / reset-password / resend-verification**: Not implemented; add Lambdas or routes that call Cognito (SignUp, ForgotPassword, etc.).
- **Admin endpoints**: `/api/admin/users`, `/api/admin/conversations`, `/api/admin/matches`, `/api/admin/chat/*`, `/api/distress` are not in this router; add when needed.
- **Support conversation**: GET/POST `/api/conversations/support` not implemented; frontend can use existing POST `/api/conversations` with support UID.
