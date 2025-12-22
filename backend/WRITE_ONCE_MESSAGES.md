# Write-Once Messages & Audit Logs

## Write-Once Messages

### Principle
**Messages are immutable once created** - they cannot be edited or deleted. This ensures:
- Data integrity and conversation history preservation
- IRB/HIPAA compliance expectations
- Prevention of tampering
- Audit trail completeness

### Implementation

#### DynamoDB Table Structure
- Messages table uses `conversation_id` (partition key) + `created_at` (sort key)
- No `updated_at` field on messages
- Messages include `hidden` flag for moderation (instead of deletion)

#### Code Enforcement
- **No UPDATE operations** on messages table
- **No DELETE operations** on messages table
- Only `PutItem` (INSERT) operations allowed
- If moderation is needed: set `hidden=true` flag, don't delete

#### Example
```javascript
// ✅ CORRECT: Create message (write-once)
await putItem(TABLES.messages, {
  id: messageId,
  conversation_id: conversationId,
  sender_id: userId,
  content: content,
  created_at: Date.now(),
  hidden: false  // For moderation, not deletion
});

// ❌ WRONG: Never do this
await updateItem(TABLES.messages, { id: messageId }, { content: 'edited' });
await deleteItem(TABLES.messages, { id: messageId });
```

### Moderation
If a message needs to be hidden:
- Set `hidden: true` flag (new field)
- Message remains in database for audit purposes
- Filter `hidden: true` messages in queries
- Never delete the message

## Audit Logs

### Purpose
Append-only log of **important system actions** (not user chat messages):
- User consent granted/revoked
- Distress alerts triggered
- Admin actions (user disable, suspend, etc.)
- Auth events (login, registration, etc.)

### Structure

#### DynamoDB Table: `audit_logs`
- **Partition Key**: `id` (UUID)
- **Sort Key**: `timestamp` (for chronological ordering)
- **GSI 1**: `event-type-index` (query by event type)
- **GSI 2**: `user-index` (query by user)

#### Log Entry Fields
- `id` - Unique log entry ID
- `timestamp` - When the event occurred
- `event_type` - Type of event (e.g., 'user_consent_granted', 'distress_alert')
- `action` - Action taken ('create', 'update', 'grant', 'revoke', etc.)
- `actor_id` - Who performed the action
- `actor_type` - Type of actor ('user', 'admin', 'system')
- `resource_type` - Type of resource affected ('user', 'conversation', 'message')
- `resource_id` - ID of resource affected
- `user_id` - ID of user affected (if different from actor)
- `metadata` - Additional context (JSON object)
- `reason` - Reason for the action (optional)
- `ip_address` - IP address of request (optional)
- `user_agent` - User agent string (optional)

### Implementation

#### Usage
```javascript
const auditLogs = require('../../shared/audit');

// User consent
await auditLogs.consentGranted(userId, conversationId, actorId);

// Distress alert
await auditLogs.distressAlert(userId, level, message, adminId);

// Admin action
await auditLogs.adminAction('disable', 'user', userId, adminId, reason);

// Auth events
await auditLogs.userLogin(userId, ipAddress, userAgent);
await auditLogs.userRegistered(userId, email, ipAddress);
```

#### Append-Only Enforcement
- Audit logs table: **PutItem only**
- No UpdateItem or DeleteItem operations
- IAM policy explicitly denies updates/deletes on audit logs table
- Once written, log entries are immutable

### Querying Audit Logs

#### By Event Type
```javascript
const { query } = require('../../shared/database');
const result = await query(TABLES.auditLogs, {
  expression: 'event_type = :eventType',
  names: {},
  values: { ':eventType': 'distress_alert' }
}, {
  indexName: 'event-type-index',
  scanForward: false  // Most recent first
});
```

#### By User
```javascript
const result = await query(TABLES.auditLogs, {
  expression: 'user_id = :userId',
  names: {},
  values: { ':userId': userId }
}, {
  indexName: 'user-index',
  scanForward: false
});
```

## Compliance Benefits

### IRB Requirements
- **Immutable conversation history** - proves what was said and when
- **Audit trail** - shows who did what and when
- **Data integrity** - prevents tampering with research data

### HIPAA Requirements
- **Audit logging** - tracks access and modifications
- **Data integrity** - prevents unauthorized changes
- **Accountability** - clear record of all actions

### Answering Questions
- "Was this message altered?" → No, messages are write-once
- "When did consent change?" → Query audit logs by event_type='user_consent_*'
- "Who triggered this alert?" → Query audit logs by event_type='distress_alert'
- "When did this user last login?" → Query audit logs by user_id and event_type='user_login'

