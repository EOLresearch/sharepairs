# DynamoDB Table Schema (HIPAA-minded)

Table names are env-driven: `USERS_TABLE`, `CONVERSATIONS_TABLE`, `MESSAGES_TABLE` (default `sharepairs-{STAGE}-users`, etc.).

## users

| Attribute       | Type   | Key   | Description                    |
|----------------|--------|-------|--------------------------------|
| id             | String | PK    | User ID (uid from Cognito/sub) |
| email          | String | GSI PK| Email (lowercase); GSI: email-index |
| password       | String |       | Stub auth only; omit in prod   |
| password_hash  | String |       | Stub auth hashed password      |
| display_name   | String |       |                                |
| is_admin       | Boolean|       |                                |
| simpatico_match| Map/S  |       | Match uid or embedded object   |
| contacts       | List   |       | Array of contact objects       |
| chat_disabled  | Boolean|       |                                |
| has_seen_match | Boolean|       |                                |
| created_at     | Number |       | Unix ms                        |
| updated_at     | Number |       | Unix ms                        |

**GSI:** `email-index` — PK: `email` (for stub login by email).

## conversations

| Attribute     | Type   | Key | Description                    |
|---------------|--------|-----|--------------------------------|
| id            | String | PK  | Conversation ID: `{uidA}+{uidB}` (sorted) |
| users         | List   |     | [uidA, uidB]                   |
| requester     | String |     | Initiator uid                  |
| recipient     | String |     | Other uid                      |
| consent_by    | List   |     | Uids who have consented        |
| mutual_consent| Boolean|     |                                |
| is_closed     | Boolean|     |                                |
| has_unread_by | List   |     | Uids with unread               |
| seen_by       | Map    |     | uid -> timestamp               |
| last_msg_at   | Number |     | Unix ms                        |
| last_msg_preview | String |   |                                |
| last_sender_id| String |     |                                |
| created_at    | Number |     |                                |
| updated_at    | Number |     |                                |

Optional GSI for “conversations for user”: `user-id-index` PK `user_id`. If absent, list uses Scan + filter.

## messages

| Attribute           | Type   | Key | Description        |
|---------------------|--------|-----|--------------------|
| conversation_id     | String | PK  |                    |
| message_id          | String | SK  | UUID               |
| body                | String |     |                    |
| sent_from_uid       | String |     |                    |
| sent_from_display_name | String |  |                    |
| status              | String |     | sent, read         |
| client_id           | String |     | Idempotency        |
| created_at          | Number |     | Unix ms            |

No separate consent_requests table; consent is stored on the conversation document.
