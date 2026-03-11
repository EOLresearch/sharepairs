# Backend file structure

```
backend/
├── package.json
├── DEPLOY.md              # Deploy steps
├── STRUCTURE.md           # This file
├── shared/
│   ├── config.js          # Env-based config (tables, STUB_AUTH, CORS)
│   ├── cors.js            # CORS headers + preflight
│   ├── response.js        # success() / error() with CORS
│   ├── auth.js            # authenticateUser(event) — Bearer or cookie, Cognito or stub
│   ├── stubAuth.js        # Stub login (findUserByEmail, signStubToken, verifyStubToken)
│   ├── database.js        # getItem, putItem, updateItem, query, scan, TABLES
│   ├── validation.js      # Joi schemas (existing)
│   └── audit.js           # Audit logging (existing)
├── functions/
│   ├── api/
│   │   ├── index.js       # Lambda entry: handler = route
│   │   ├── router.js      # Routes by method + path, dispatches to handlers
│   │   └── handlers/
│   │       ├── auth.js    # login, me, mePatch
│   │       ├── matches.js # getMatches
│   │       ├── messages.js# getMessages, sendMessage, markSeen
│   │       ├── consent.js # consentRequest, consentRespond
│   │       └── conversations.js # listConversations, createConversation
│   └── distress/          # (existing) distress submit Lambda
├── scripts/
│   └── seed.js            # Create tables + seed dev users
└── infra/
    └── SCHEMA.md          # DynamoDB table schema
```

## API route → handler mapping

| Method | Path                    | Handler                      |
|--------|-------------------------|------------------------------|
| OPTIONS| *                       | corsPreflight()              |
| POST   | /api/auth/login         | auth.login                   |
| GET    | /api/auth/me            | auth.me                      |
| PATCH  | /api/auth/me            | auth.mePatch                 |
| GET    | /api/matches            | matches.getMatches           |
| GET    | /api/messages           | messages.getMessages         |
| POST   | /api/messages/send      | messages.sendMessage         |
| POST   | /api/messages/seen      | messages.markSeen            |
| POST   | /api/consent/request    | consent.consentRequest       |
| POST   | /api/consent/respond    | consent.consentRespond       |
| GET    | /api/conversations      | conversations.listConversations |
| POST   | /api/conversations      | conversations.createConversation |
