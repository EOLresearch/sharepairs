import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, putItem, query, updateItem } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import crypto from 'crypto';

function toConvoId(u1, u2) {
  const [a, b] = [String(u1), String(u2)].sort();
  return `${a}+${b}`;
}

/**
 * GET /api/messages?conversationId=...
 * Optional: before= cursor, pageSize=10 for pagination
 */
export async function getMessages(event) {
  try {
    await authenticateUser(event);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
  const q = event.queryStringParameters || {};
  const conversationId = q.conversationId;
  if (!conversationId) return error('conversationId required', 400);

  const limit = Math.min(parseInt(q.pageSize || '50', 10) || 50, 100);
  const before = q.before || null;

  const params = {
    KeyConditionExpression: 'conversation_id = :cid',
    ExpressionAttributeValues: { ':cid': conversationId },
    Limit: limit,
    ScanIndexForward: false,
  };
  if (before) {
    params.ExclusiveStartKey = { conversation_id: conversationId, message_id: before };
  }

  const items = await query(TABLES.MESSAGES, params);
  const messages = items.map((m) => ({
    id: m.message_id,
    mid: m.message_id,
    body: m.body,
    sentFromUid: m.sent_from_uid,
    sentFromDisplayName: m.sent_from_display_name || '',
    status: m.status || 'sent',
    clientId: m.client_id,
    createdAt: m.created_at ? { seconds: Math.floor(m.created_at / 1000) } : null,
  }));
  const hasMore = items.length === limit;
  const lastDoc = items.length ? items[items.length - 1]?.message_id : null;
  return success({
    messages: messages.reverse(),
    lastDoc,
    hasMore,
  });
}

/**
 * POST /api/messages/send
 * Body: { conversationId, body, senderDisplayName?, clientId? }
 */
export async function sendMessage(event) {
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
  const conversationId = body.conversationId;
  const text = body.body && String(body.body).trim();
  if (!conversationId || !text) return error('conversationId and body required', 400);

  const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
  if (!convo) return error('Conversation not found', 404);
  const users = convo.users || [];
  if (!users.includes(auth.userId)) return error('Not a participant', 403);

  const messageId = crypto.randomUUID();
  const now = Date.now();
  await putItem(TABLES.MESSAGES, {
    conversation_id: conversationId,
    message_id: messageId,
    body: text,
    sent_from_uid: auth.userId,
    sent_from_display_name: body.senderDisplayName || auth.displayName || '',
    status: 'sent',
    client_id: body.clientId || null,
    created_at: now,
  });

  const others = users.filter((u) => u !== auth.userId);
  const hasUnreadBy = [...(convo.has_unread_by || []), ...others];
  await updateItem(
    TABLES.CONVERSATIONS,
    { id: conversationId },
    {
      last_msg_at: now,
      last_msg_preview: text.slice(0, 140),
      last_sender_id: auth.userId,
      has_unread_by: [...new Set(hasUnreadBy)],
      updated_at: now,
    }
  );

  return success({
    messageId,
    mid: messageId,
    body: text,
    sentFromUid: auth.userId,
    sentFromDisplayName: body.senderDisplayName || auth.displayName || '',
    status: 'sent',
    createdAt: { seconds: Math.floor(now / 1000) },
  });
}

/**
 * POST /api/messages/seen
 * Body: { conversationId, uid }
 */
export async function markSeen(event) {
  try {
    await authenticateUser(event);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }
  const conversationId = body.conversationId;
  const uid = body.uid;
  if (!conversationId || !uid) return error('conversationId and uid required', 400);

  const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
  if (!convo) return error('Conversation not found', 404);
  const hasUnreadBy = (convo.has_unread_by || []).filter((u) => u !== uid);
  const seenBy = { ...(convo.seen_by || {}), [uid]: Date.now() };
  await updateItem(TABLES.CONVERSATIONS, { id: conversationId }, {
    has_unread_by: hasUnreadBy,
    seen_by: seenBy,
    updated_at: Date.now(),
  });
  return success({ ok: true });
}
