import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, putItem, query, updateItem } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import { config } from '../../../shared/config.js';
import crypto from 'crypto';
import {
  isMessagingBlocked,
  isSupportConversation,
  messagingBlockedMessage,
} from '../../../shared/conversationModeration.js';
import {
  toMessageShape,
  flagConversationForReview,
  includeStaffMessageFields,
  newId,
} from '../../../shared/messageModeration.js';
import { recordPeerInterventionStart } from '../../../shared/assessments/service.js';

function toConvoId(u1, u2) {
  const [a, b] = [String(u1), String(u2)].sort();
  return `${a}+${b}`;
}

/**
 * GET /api/messages?conversationId=...
 * Optional: before= cursor, pageSize=10 for pagination
 */
export async function getMessages(event) {
  let auth;
  try {
    auth = await authenticateUser(event);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
  const q = event.queryStringParameters || {};
  const conversationId = q.conversationId;
  if (!conversationId) return error('conversationId required', 400);

  const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
  if (!convo) return error('Conversation not found', 404);
  const users = convo.users || [];
  const isAdmin = Boolean(auth.isAdmin || auth.is_admin);
  if (!isAdmin && !users.includes(auth.userId)) return error('Not a participant', 403);
  const isSupport =
    users.includes(config.supportUid) ||
    convo.recipient === config.supportUid ||
    convo.requester === config.supportUid ||
    convo.type === 'support';
  if (!convo.mutual_consent && !isSupport && !isAdmin) {
    return error('Conversation is not mutually accepted yet', 403);
  }

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
  const staffView = includeStaffMessageFields({
    isAdmin,
    viewerUid: auth.userId,
    participantUids: users,
  });
  const messages = items.map((m) => toMessageShape(m, { isAdmin: staffView, viewerUid: auth.userId }));
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
  const isSupport = isSupportConversation(convo, config.supportUid);
  if (!convo.mutual_consent && !isSupport && !auth.isAdmin) {
    return error('Conversation is not mutually accepted yet', 403);
  }

  // Distress suspend: sender must not have chat disabled (unless support convo or admin)
  const senderChatDisabled = auth.chat_disabled === true || auth.chatDisabled === true;
  if (senderChatDisabled && !isSupport && !auth.isAdmin) {
    return error('Chat is suspended. You cannot send messages until the study team re-enables access.', 403);
  }

  if (isMessagingBlocked(convo, { isSupport })) {
    return error(messagingBlockedMessage(convo), 403);
  }

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

  if (!isSupport) {
    try {
      await recordPeerInterventionStart(convo, now);
    } catch (err) {
      console.warn('[messages.send] follow-up assignment failed:', err?.message || err);
    }
  }

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

  const messagePayload = {
    id: messageId,
    mid: messageId,
    body: text,
    sentFromUid: auth.userId,
    sentFromDisplayName: body.senderDisplayName || auth.displayName || '',
    status: 'sent',
    clientId: body.clientId || null,
    createdAt: { seconds: Math.floor(now / 1000) },
  };

  // Push to all participants (local WS registry or API Gateway connections)
  try {
    const { broadcastToUsers } = await import('../../../shared/broadcast.js');
    await broadcastToUsers(users, {
      type: 'message',
      payload: {
        conversationId,
        message: messagePayload,
      },
    });
  } catch (err) {
    console.warn('Realtime broadcast failed:', err?.message || err);
  }

  return success(messagePayload);
}

/**
 * POST /api/messages/seen
 * Body: { conversationId, uid }
 */
export async function markSeen(event) {
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
  const uid = body.uid;
  if (!conversationId || !uid) return error('conversationId and uid required', 400);

  const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
  if (!convo) return error('Conversation not found', 404);
  if (!(convo.users || []).includes(auth.userId)) return error('Not a participant', 403);
  const hasUnreadBy = (convo.has_unread_by || []).filter((u) => u !== uid);
  const seenBy = { ...(convo.seen_by || {}), [uid]: Date.now() };
  await updateItem(TABLES.CONVERSATIONS, { id: conversationId }, {
    has_unread_by: hasUnreadBy,
    seen_by: seenBy,
    updated_at: Date.now(),
  });
  return success({ ok: true });
}

/**
 * POST /api/messages/report
 * Body: { conversationId, messageId, explanation }
 * Does not pause or terminate the match.
 */
export async function reportMessage(event) {
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
  const messageId = body.messageId || body.mid;
  const explanation = String(body.explanation || '').trim();
  if (!conversationId || !messageId) return error('conversationId and messageId required', 400);
  if (explanation.length < 3) return error('Please include a short explanation.', 400);
  if (explanation.length > 1000) return error('Explanation is too long.', 400);

  const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
  if (!convo) return error('Conversation not found', 404);
  const users = convo.users || [];
  if (!users.includes(auth.userId)) return error('Not a participant', 403);

  const msg = await getItem(TABLES.MESSAGES, {
    conversation_id: conversationId,
    message_id: messageId,
  });
  if (!msg) return error('Message not found', 404);
  if (msg.sent_from_uid === auth.userId) {
    return error('You cannot report your own message.', 400);
  }

  const reports = Array.isArray(msg.reports) ? [...msg.reports] : [];
  if (reports.some((r) => r.reporterUid === auth.userId || r.reporter_uid === auth.userId)) {
    return error('You have already reported this message.', 409);
  }

  const report = {
    id: newId(),
    reporterUid: auth.userId,
    reporterName: auth.displayName || auth.userData?.displayName || '',
    explanation,
    createdAt: Date.now(),
  };
  reports.push(report);
  await updateItem(
    TABLES.MESSAGES,
    { conversation_id: conversationId, message_id: messageId },
    { reports, updated_at: Date.now() }
  );

  await flagConversationForReview(convo, {
    highPriority: true,
    reason: 'participant_report',
    reporterLabel: report.reporterName || auth.email || auth.userId,
    explanation,
    messagePreview: String(msg.body || '').slice(0, 280),
    incrementReport: true,
  });

  return success({
    ok: true,
    reported: true,
    terminated: false,
    message: toMessageShape(
      { ...msg, reports },
      { isAdmin: false, viewerUid: auth.userId }
    ),
  });
}
