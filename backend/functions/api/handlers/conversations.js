import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, putItem, query, scan } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import { config } from '../../../shared/config.js';
import { ensureSupportUser } from '../../../shared/supportUser.js';
import { monitorFields, enrichConvosForViewer } from '../../../shared/conversations.js';

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
    type: row.type || null,
    consentBy: row.consent_by,
    consentGivenBy: row.consent_by,
    mutualConsent: Boolean(row.mutual_consent),
    isClosed: Boolean(row.is_closed),
    moderationStatus:
      row.moderation_status === 'paused' || row.moderation_status === 'terminated'
        ? row.moderation_status
        : 'active',
    ...monitorFields(row),
    hasUnreadBy: row.has_unread_by || [],
    lastMsgAt: row.last_msg_at,
    lastMsgPreview: row.last_msg_preview,
    lastSenderId: row.last_sender_id,
    interventionStartAt: row.intervention_start_at || null,
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
  // Always scope to the signed-in user (guards memory-db / odd GSI rows)
  const uid = String(auth.userId);
  items = (items || []).filter((c) =>
    Array.isArray(c.users) && c.users.map(String).includes(uid)
  );
  return success({ conversations: await enrichConvosForViewer(items, auth.userId) });
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

  const chatDisabled = auth.chat_disabled === true || auth.chatDisabled === true;
  if (chatDisabled && !auth.isAdmin) {
    return error(
      'Chat is suspended. You cannot start conversations until the study team re-enables access.',
      403
    );
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
    moderation_status: 'active',
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

/**
 * GET /api/conversations/support
 * POST /api/conversations/support
 * Creates or returns the Study Support conversation (mutual consent on create).
 * Auth user is always the participant — same path local and study.
 */
export async function supportConversation(event) {
  let auth;
  try {
    auth = await authenticateUser(event);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }

  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
  // Always the signed-in user (ignore client-supplied userUid except for admins)
  let userUid = auth.userId;
  if (method === 'GET') {
    const q = event.queryStringParameters || {};
    if (q.userUid && auth.isAdmin) userUid = q.userUid;
  } else {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    if (body.userUid && auth.isAdmin) userUid = body.userUid;
  }

  try {
    await ensureSupportUser();
  } catch (err) {
    console.error('ensureSupportUser failed:', err);
    return error(
      `Study Support account could not be prepared: ${err.message || err}`,
      500,
      { code: 'support/ensure-failed' }
    );
  }

  const supportUid = config.supportUid;
  if (!supportUid) {
    return error('SUPPORT_UID is not configured', 500, { code: 'support/misconfigured' });
  }
  if (userUid === supportUid) {
    return error('Study Support cannot open a support thread with itself', 400);
  }

  const cid = toConvoId(userUid, supportUid);
  let convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
  const now = Date.now();
  let created = false;

  if (!convo) {
    if (method === 'GET') {
      return error('Not Found', 404);
    }
    const users = sortPair(userUid, supportUid);
    convo = {
      id: cid,
      users,
      requester: userUid,
      recipient: supportUid,
      type: 'support',
      consent_by: [userUid, supportUid],
      mutual_consent: true,
      is_closed: false,
      moderation_status: 'active',
      has_unread_by: [],
      last_msg_at: null,
      last_msg_preview: null,
      last_sender_id: null,
      created_at: now,
      updated_at: now,
    };
    await putItem(TABLES.CONVERSATIONS, convo);
    created = true;
  } else if (!convo.mutual_consent || convo.type !== 'support') {
    // Upgrade legacy support threads to open chat
    await putItem(TABLES.CONVERSATIONS, {
      ...convo,
      type: 'support',
      consent_by: [userUid, supportUid],
      mutual_consent: true,
      updated_at: now,
    });
    convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
  }

  try {
    const { notifyConversationUpdate } = await import('../../../shared/conversations.js');
    await notifyConversationUpdate(convo.users || [userUid, supportUid], convo);
  } catch (err) {
    // Realtime notify is best-effort — create/open must still succeed (local + live)
    console.warn('notifyConversationUpdate failed:', err?.message || err);
  }

  const shape = toConvoShape(convo);
  return success({
    docID: cid,
    conversation: shape,
    created,
    ...shape,
  });
}
