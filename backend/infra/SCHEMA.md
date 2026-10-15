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
| photo_url      | String |       | Avatar URL                     |
| preferred_language | String |   | `en`                           |
| timezone       | String |       |                                |
| is_admin       | Boolean|       | Never set via public register  |
| email_verified | Boolean|       | Explicit false until confirmed; missing = verified (legacy seeds) |
| email_verification_hash | String | | HMAC of pending 6-digit code (stub) |
| email_verification_expires | Number | | Unix ms; code TTL 15 minutes |
| study_consent  | Boolean|       | IRB consent at signup          |
| country        | String |       | Study demographics             |
| residence      | String |       | State / province               |
| birth_date     | String |       | ISO date; must be 18+          |
| race           | String |       |                                |
| ethnicity      | String |       |                                |
| bio_sex        | String |       |                                |
| education      | String |       |                                |
| household      | String |       |                                |
| hobbies        | String |       |                                |
| loss_date      | String |       |                                |
| kinship        | String |       |                                |
| cause          | String |       |                                |
| deceased_age   | String |       |                                |
| loss_exp       | String |       | Loss experience narrative      |
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
| intervention_start_at | Number | | Write-once Unix ms of the first real peer message in this match conversation. Starts the shared 56-day follow-up clock for both participants. Not set by support threads, match, or consent. |
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

## prompts

| Attribute   | Type    | Key | Description                          |
|-------------|---------|-----|--------------------------------------|
| id          | String  | PK  | UUID                                 |
| text        | String  |     | English prompt body                  |
| mode        | String  |     | `starter` \| `idea`                  |
| category    | String  |     | greetings, checking_in, everyday_life, shared_experience, encouragement, closing |
| active      | Boolean |     | Inactive hidden from chat            |
| sort_order  | Number  |     | Display order within category        |
| impressions | Number |     | Times shown in chat (atomic ADD)     |
| clicks      | Number  |     | Times a participant selected the chip |
| sends       | Number  |     | Times a starter was inserted into the composer |
| created_at  | Number  |     | Unix ms                              |
| updated_at  | Number  |     | Unix ms                              |

Admin-editable chat prompt bank (conversation starters). Participant `GET /api/prompts` returns active only and upserts any missing default prompts (deduped by mode + normalized text; never duplicates). Analytics via `POST /api/prompts/:id/events` with `{ type: "impression" | "click" | "send" }` using atomic `ADD` updates on `impressions` / `clicks` / `sends`.

Participant orientation uses existing `users.has_seen_match` — when a match exists and the flag is false, the orientation overlay is shown before chat. **Begin Conversation** sets `has_seen_match: true`.
