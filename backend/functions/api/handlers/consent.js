import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, putItem, updateItem, query } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import crypto from 'crypto';

function sortPair(a, b) {
  return a < b ? [a, b] : [b, a];
}
function toConvoId(u1, u2) {
  const [a, b] = sortPair(String(u1), String(u2));
  return `${a}+${b}`;
}

/**
 * POST /api/consent/request
 * Body: { matchId } — request a conversation with matchId (other user uid)
 */
export async function consentRequest(event) {
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
  const matchId = body.matchId && String(body.matchId).trim();
  if (!matchId) return error('matchId required', 400);
  if (matchId === auth.userId) return error('Cannot request conversation with yourself', 400);

  const cid = toConvoId(auth.userId, matchId);
  let convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
  const now = Date.now();

  if (convo) {
    const consentBy = convo.consent_by || [];
    if (consentBy.includes(auth.userId)) {
      return success({
        docID: cid,
        conversation: toConvoShape(convo),
        created: false,
      });
    }
    const updated = [...consentBy, auth.userId];
    const mutualConsent = (convo.users || []).length === 2 && updated.length === 2;
    await updateItem(TABLES.CONVERSATIONS, { id: cid }, {
      consent_by: updated,
      mutual_consent: mutualConsent,
      updated_at: now,
    });
    convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
    return success({
      docID: cid,
      conversation: toConvoShape(convo),
      mutualConsent,
      created: false,
    });
  }

  const users = sortPair(auth.userId, matchId);
  convo = {
    id: cid,
    users,
    requester: auth.userId,
    recipient: matchId,
    consent_by: [auth.userId],
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
  return success({
    docID: cid,
    conversation: toConvoShape(convo),
    mutualConsent: false,
    created: true,
  });
}

/**
 * POST /api/consent/respond
 * Body: { requestId (conversation id), accept: true|false }
 */
export async function consentRespond(event) {
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
  const requestId = body.requestId && String(body.requestId).trim();
  const accept = body.accept !== false;
  if (!requestId) return error('requestId required', 400);

  const convo = await getItem(TABLES.CONVERSATIONS, { id: requestId });
  if (!convo) return error('Conversation not found', 404);
  const users = convo.users || [];
  if (!users.includes(auth.userId)) return error('Not a participant', 403);

  let consentBy = convo.consent_by || [];
  if (accept && !consentBy.includes(auth.userId)) {
    consentBy = [...consentBy, auth.userId];
  }
  const mutualConsent = users.length === 2 && consentBy.length === 2;
  await updateItem(TABLES.CONVERSATIONS, { id: requestId }, {
    consent_by: consentBy,
    mutual_consent: mutualConsent,
    seen_by: convo.seen_by || {},
    updated_at: Date.now(),
  });
  return success({ mutualConsent });
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
