import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, putItem, query, scan } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';

function sortPair(a, b) {
  return a < b ? [a, b] : [b, a];
}
function toConvoId(u1, u2) {
  const [a, b] = sortPair(String(u1), String(u2));
  return `${a}+${b}`;
}

function toConvoShape(row) {
  if (!row) return null;
  return {
    docID: row.id,
    cid: row.id,
    users: row.users,
    requester: row.requester,
    recipient: row.recipient,
    consentBy: row.consent_by,
    consentGivenBy: row.consent_by,
    mutualConsent: Boolean(row.mutual_consent),
    isClosed: Boolean(row.is_closed),
    hasUnreadBy: row.has_unread_by || [],
    lastMsgAt: row.last_msg_at,
    lastMsgPreview: row.last_msg_preview,
    lastSenderId: row.last_sender_id,
    seenBy: row.seen_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/conversations — list conversations for current user
 */
export async function listConversations(event) {
  let auth;
  try {
    auth = await authenticateUser(event);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
  let items = [];
  try {
    items = await query(TABLES.CONVERSATIONS, {
      IndexName: 'user-id-index',
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: { ':uid': auth.userId },
    });
  } catch {
    // No GSI: fallback scan
    const all = await scan(TABLES.CONVERSATIONS);
    items = all.filter((c) => (c.users || []).includes(auth.userId));
  }
  return success({ conversations: items.map(toConvoShape) });
}

/**
 * POST /api/conversations — create or get conversation (initiatorUid, otherUid)
 */
export async function createConversation(event) {
  let auth;
  try {
    auth = await authenticateUser(event);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }
  const initiatorUid = body.initiatorUid || body.initiator_uid;
  const otherUid = body.otherUid || body.other_uid;
  if (!initiatorUid || !otherUid) return error('initiatorUid and otherUid required', 400);
  if (auth.userId !== initiatorUid) return error('Forbidden', 403);

  const cid = toConvoId(initiatorUid, otherUid);
  let convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
  const now = Date.now();

  if (convo) {
    return success({
      docID: cid,
      conversation: toConvoShape(convo),
      created: false,
      ...toConvoShape(convo),
    });
  }

  const users = sortPair(initiatorUid, otherUid);
  convo = {
    id: cid,
    users,
    requester: initiatorUid,
    recipient: otherUid,
    consent_by: [initiatorUid],
    mutual_consent: false,
    is_closed: false,
    has_unread_by: [],
    last_msg_at: null,
    last_msg_preview: null,
    last_sender_id: null,
    created_at: now,
    updated_at: now,
  };
  await putItem(TABLES.CONVERSATIONS, convo);
  const shape = toConvoShape(convo);
  return success({
    docID: cid,
    conversation: shape,
    created: true,
    ...shape,
  });
}
