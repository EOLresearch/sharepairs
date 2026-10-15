/**
 * Message service — messages and conversation read state via REST + WebSocket push.
 */

import { on, off, getConnectionState as getWsState } from '../realtime';
import { getConnectionState } from '../connection';
import { apiFetch } from './http';

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

function isWsConnected() {
  return getWsState() === 'connected';
}

/**
 * Get messages for a conversation (one-shot).
 */
export async function getMessages(conversationId) {
  const res = await apiFetch(
    `${MESSAGES_BASE}?conversationId=${encodeURIComponent(conversationId)}`
  );
  const data = await handleResponse(res);
  return Array.isArray(data.messages) ? data.messages : data;
}

/**
 * Send a message.
 */
export async function sendMessage(conversationId, message) {
  const payload =
    typeof message === 'string'
      ? { conversationId, body: message }
      : { conversationId, ...message };
  const res = await apiFetch(`${MESSAGES_BASE}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

function messageTime(m) {
  if (m?.createdAt?.seconds != null) return Number(m.createdAt.seconds);
  if (m?.createdAt?._seconds != null) return Number(m.createdAt._seconds);
  if (typeof m?.createdAt === 'number') return m.createdAt > 1e12 ? m.createdAt / 1000 : m.createdAt;
  if (m?.created_at != null) {
    const n = Number(m.created_at);
    return n > 1e12 ? n / 1000 : n;
  }
  return 0;
}

function sortMessages(msgs) {
  // Oldest → newest so the latest message renders at the bottom
  return [...msgs].sort((a, b) => {
    const at = messageTime(a);
    const bt = messageTime(b);
    if (at !== bt) return at - bt;
    return String(a.mid || a.id || '').localeCompare(String(b.mid || b.id || ''));
  });
}

/**
 * Subscribe to messages for a conversation via WebSocket (fallback poll when disconnected).
 */
export function listenToMessages(conversationId, callback) {
  if (!conversationId || typeof callback !== 'function') return () => {};

  let messages = [];
  let cancelled = false;
  let pollTimer = null;

  const emit = () => callback(sortMessages(messages));

  const mergeMessage = (msg) => {
    if (!msg) return;
    const mid = msg.mid || msg.id;
    const idx = messages.findIndex(
      (m) => (mid && m.mid === mid) || (msg.clientId && m.clientId === msg.clientId)
    );
    if (idx >= 0) messages[idx] = { ...messages[idx], ...msg };
    else messages.push(msg);
    emit();
  };

  const handleWsMessage = (payload) => {
    if (payload?.conversationId !== conversationId) return;
    if (payload?.message) mergeMessage(payload.message);
  };

  const refresh = async ({ initial = false } = {}) => {
    if (cancelled) return;
    const offlineReconnect =
      getConnectionState().status === 'reconnecting' && !isWsConnected();
    if (offlineReconnect) {
      // Still notify subscribers so conversation open isn't stuck waiting.
      if (initial) emit();
      return;
    }
    try {
      const list = await getMessages(conversationId);
      if (cancelled) return;
      if (Array.isArray(list)) {
        messages = list;
        emit();
      } else if (initial) {
        emit();
      }
    } catch (err) {
      if (!cancelled) {
        console.warn('messageService.listenToMessages refresh error:', err);
        if (initial) emit();
      }
    }
  };

  refresh({ initial: true });
  on('message', handleWsMessage);

  // Always poll as a safety net; poll faster when WS is down
  const schedulePoll = () => {
    if (cancelled) return;
    const delay = isWsConnected() ? POLL_INTERVAL_MS * 2 : POLL_INTERVAL_MS;
    pollTimer = setTimeout(async () => {
      await refresh();
      schedulePoll();
    }, delay);
  };
  schedulePoll();

  const onReconnect = ({ state }) => {
    if (state === 'connected') refresh();
  };
  on('connectionStateChange', onReconnect);

  return () => {
    cancelled = true;
    if (pollTimer) clearTimeout(pollTimer);
    off('message', handleWsMessage);
    off('connectionStateChange', onReconnect);
  };
}

/**
 * Fetch older (paginated) messages.
 */
export async function fetchOlderMessages(conversationId, cursor) {
  const params = new URLSearchParams({ conversationId, pageSize: '10' });
  if (cursor) params.set('before', cursor);
  const res = await apiFetch(`${MESSAGES_BASE}?${params}`);
  const data = await handleResponse(res);
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    lastDoc: data.lastDoc ?? null,
    hasMore: Boolean(data.hasMore),
  };
}

/**
 * Mark conversation as seen for a user.
 */
export async function markConversationSeen(conversationId, uid) {
  const res = await apiFetch(`${MESSAGES_BASE}/seen`, {
    method: 'POST',
    body: JSON.stringify({ conversationId, uid }),
  });
  return handleResponse(res);
}

/**
 * Participant report/flag of a message. Does not pause or terminate the match.
 */
export async function reportMessage(conversationId, messageId, explanation) {
  const res = await apiFetch(`${MESSAGES_BASE}/report`, {
    method: 'POST',
    body: JSON.stringify({ conversationId, messageId, explanation }),
  });
  return handleResponse(res);
}
