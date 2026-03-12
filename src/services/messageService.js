/**
 * Message service — messages and conversation read state via REST.
 * Endpoints: /api/messages, /api/messages/send, etc.
 */

const MESSAGES_BASE = '/api/messages';
const POLL_INTERVAL_MS = 4000;

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.code;
    throw err;
  }
  return data;
}

/**
 * Get messages for a conversation (one-shot).
 */
export async function getMessages(conversationId) {
  const res = await fetch(
    `${MESSAGES_BASE}?conversationId=${encodeURIComponent(conversationId)}`,
    { credentials: 'include' }
  );
  const data = await handleResponse(res);
  return Array.isArray(data.messages) ? data.messages : data;
}

/**
 * Send a message.
 * Payload: { conversationId, body, senderDisplayName?, clientId? }
 */
export async function sendMessage(conversationId, message) {
  const payload =
    typeof message === 'string'
      ? { conversationId, body: message }
      : { conversationId, ...message };
  const res = await fetch(`${MESSAGES_BASE}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Polling placeholder for real-time: calls callback with messages every POLL_INTERVAL_MS.
 * Returns unsubscribe function.
 */
export function listenToMessages(conversationId, callback) {
  if (!conversationId || typeof callback !== 'function') return () => {};

  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;
    try {
      const messages = await getMessages(conversationId);
      if (!cancelled && Array.isArray(messages)) callback(messages);
    } catch (err) {
      if (!cancelled) console.warn('messageService.listenToMessages poll error:', err);
    }
    if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
  };

  poll();
  return () => {
    cancelled = true;
  };
}

/**
 * Fetch older (paginated) messages. Cursor is opaque (e.g. last message id or timestamp).
 */
export async function fetchOlderMessages(conversationId, lastDoc, pageSize = 10) {
  const params = new URLSearchParams({
    conversationId,
    pageSize: String(pageSize),
  });
  if (lastDoc != null) params.set('before', String(lastDoc));
  const res = await fetch(`${MESSAGES_BASE}?${params}`, { credentials: 'include' });
  const data = await handleResponse(res);
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    lastDoc: data.lastDoc ?? null,
    hasMore: Boolean(data.hasMore),
  };
}

/**
 * Mark conversation as seen by current user (clear unread).
 */
export async function markConversationSeen(conversationId, uid) {
  const res = await fetch(`${MESSAGES_BASE}/seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, uid }),
    credentials: 'include',
  });
  return handleResponse(res);
}
