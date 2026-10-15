/**
 * Match service — matches, conversations via REST + WebSocket push.
 */

import { on, off, getConnectionState as getWsState } from '../realtime';
import { getConnectionState } from '../connection';
import { apiFetch } from './http';

const MATCHES_BASE = '/api/matches';
const CONVERSATIONS_BASE = '/api/conversations';
const CONVERSATIONS_POLL_MS = 5000;

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

export async function getMatches() {
  const res = await apiFetch(MATCHES_BASE);
  return handleResponse(res);
}

export async function requestConversation(matchId) {
  const res = await apiFetch('/api/consent/request', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  });
  return handleResponse(res);
}

export async function getConversations() {
  const res = await apiFetch(CONVERSATIONS_BASE);
  const data = await handleResponse(res);
  return Array.isArray(data.conversations) ? data.conversations : data;
}

function mergeConversation(list, convo) {
  if (!convo) return list;
  const id = convo.docID || convo.cid || convo.id;
  if (!id) return list;
  const idx = list.findIndex((c) => (c.docID || c.cid || c.id) === id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = {
      ...next[idx],
      ...convo,
      docID: id,
      otherDisplayName: convo.otherDisplayName || next[idx].otherDisplayName,
      otherUserUid: convo.otherUserUid || next[idx].otherUserUid,
    };
    return next;
  }
  return [...list, { ...convo, docID: id }];
}

/**
 * Subscribe to conversations via WebSocket (fallback poll when disconnected).
 */
export function listenToConversations(callback) {
  if (typeof callback !== 'function') return () => {};

  let list = [];
  let cancelled = false;
  let pollTimer = null;

  const emit = () => callback([...list]);

  const handleUpdate = (payload) => {
    if (payload?.conversation) {
      list = mergeConversation(list, payload.conversation);
      emit();
    }
  };

  const handleDeleted = (payload) => {
    const id = payload?.conversationId;
    if (!id) return;
    list = list.filter((c) => (c.docID || c.cid || c.id) !== id);
    emit();
  };

  const refresh = async () => {
    if (cancelled) return;
    if (getConnectionState().status === 'reconnecting' && !isWsConnected()) return;
    try {
      const fetched = await getConversations();
      if (!cancelled && Array.isArray(fetched)) {
        list = fetched;
        emit();
      }
    } catch (err) {
      if (!cancelled) console.warn('matchService.listenToConversations refresh error:', err);
    }
  };

  refresh();
  on('conversationUpdate', handleUpdate);
  on('conversationDeleted', handleDeleted);

  const schedulePoll = () => {
    if (cancelled) return;
    const delay = isWsConnected() ? CONVERSATIONS_POLL_MS * 6 : CONVERSATIONS_POLL_MS;
    pollTimer = setTimeout(async () => {
      if (!isWsConnected()) await refresh();
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
    off('conversationUpdate', handleUpdate);
    off('conversationDeleted', handleDeleted);
    off('connectionStateChange', onReconnect);
  };
}

export async function createConversation(initiatorUid, otherUid) {
  const res = await apiFetch(CONVERSATIONS_BASE, {
    method: 'POST',
    body: JSON.stringify({ initiatorUid, otherUid }),
  });
  return handleResponse(res);
}

export async function createSupportConvoIfMissing(_userUid) {
  // Server always uses the authenticated user — do not trust client userUid
  const res = await apiFetch(`${CONVERSATIONS_BASE}/support`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

export async function getSupportConvoIfExists(_userUid) {
  const res = await apiFetch(`${CONVERSATIONS_BASE}/support`);
  if (res.status === 404) return null;
  return handleResponse(res);
}

export async function getAllUsers() {
  const res = await apiFetch('/api/admin/users');
  const data = await handleResponse(res);
  return Array.isArray(data.users) ? data.users : data;
}

export async function listInvites() {
  const res = await apiFetch('/api/admin/invites');
  return handleResponse(res);
}

export async function createInvite() {
  const res = await apiFetch('/api/admin/invites', {
    method: 'POST',
    body: '{}',
  });
  return handleResponse(res);
}

export async function listEligibleScreeners() {
  const res = await apiFetch('/api/admin/screeners');
  return handleResponse(res);
}

export async function issueScreenerAccessCode(screenerId) {
  const res = await apiFetch('/api/admin/screeners/access-code', {
    method: 'POST',
    body: JSON.stringify({ screenerId }),
  });
  return handleResponse(res);
}

export async function getAllConversations() {
  const res = await apiFetch('/api/admin/conversations');
  const data = await handleResponse(res);
  return Array.isArray(data.conversations) ? data.conversations : data;
}

export async function updateMatch(uid, matchUid) {
  const res = await apiFetch('/api/admin/matches', {
    method: 'POST',
    body: JSON.stringify({ uid, matchUid }),
  });
  return handleResponse(res);
}

export async function removeMatch(uid) {
  const res = await apiFetch('/api/admin/matches/remove', {
    method: 'POST',
    body: JSON.stringify({ uid }),
  });
  return handleResponse(res);
}

/** Hard-delete a user (testing) so the email can register again. */
export async function deleteUser(uid) {
  const res = await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function enableChatForUser(uid) {
  const res = await apiFetch('/api/admin/chat/enable', {
    method: 'POST',
    body: JSON.stringify({ uid }),
  });
  return handleResponse(res);
}

export async function disableChatForUser(uid) {
  const res = await apiFetch('/api/admin/chat/disable', {
    method: 'POST',
    body: JSON.stringify({ uid }),
  });
  return handleResponse(res);
}

export async function deleteAdminConversation(conversationId) {
  const res = await apiFetch('/api/admin/conversations/delete', {
    method: 'POST',
    body: JSON.stringify({ conversationId }),
  });
  return handleResponse(res);
}

export async function setConversationModeration(conversationId, status) {
  const res = await apiFetch('/api/admin/conversations/moderation', {
    method: 'POST',
    body: JSON.stringify({ conversationId, status }),
  });
  return handleResponse(res);
}

export async function setConversationMonitor(conversationId, flags) {
  const res = await apiFetch('/api/admin/conversations/monitor', {
    method: 'POST',
    body: JSON.stringify({ conversationId, ...flags }),
  });
  return handleResponse(res);
}

export async function addAdminMessageNote(conversationId, messageId, body) {
  const res = await apiFetch('/api/admin/messages/notes', {
    method: 'POST',
    body: JSON.stringify({ conversationId, messageId, body }),
  });
  return handleResponse(res);
}

export async function addAdminConversationNote(conversationId, body) {
  const res = await apiFetch('/api/admin/conversations/notes', {
    method: 'POST',
    body: JSON.stringify({ conversationId, body }),
  });
  return handleResponse(res);
}

export async function addAdminUserNote(uid, body) {
  const res = await apiFetch('/api/admin/users/notes', {
    method: 'POST',
    body: JSON.stringify({ uid, body }),
  });
  return handleResponse(res);
}

export async function assignAdminConversation(conversationId, uid) {
  const res = await apiFetch('/api/admin/conversations/assign', {
    method: 'POST',
    body: JSON.stringify({ conversationId, uid: uid || null }),
  });
  return handleResponse(res);
}

/**
 * Admin: distress thermometer history for a participant.
 * @param {string} uid
 * @param {{ limit?: number, all?: boolean }} [opts]
 */
export async function getUserDistress(uid, opts = {}) {
  const params = new URLSearchParams({ uid });
  if (opts.all) params.set('all', '1');
  else if (opts.limit != null) params.set('limit', String(opts.limit));
  const res = await apiFetch(`/api/admin/distress?${params.toString()}`);
  return handleResponse(res);
}

/** Active prompts for chat (participant). */
export async function getPrompts() {
  const res = await apiFetch('/api/prompts');
  const data = await handleResponse(res);
  return Array.isArray(data.prompts) ? data.prompts : [];
}

/**
 * Record a prompt analytics event (impression | click | send).
 * Fire-and-forget safe — failures are logged, not thrown to UI.
 */
export async function trackPromptEvent(promptId, type) {
  if (!promptId || !type) return null;
  try {
    const res = await apiFetch(`/api/prompts/${encodeURIComponent(promptId)}/events`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
    return handleResponse(res);
  } catch (err) {
    console.warn('trackPromptEvent failed:', err?.message || err);
    return null;
  }
}

/** Admin: all prompts including inactive. */
export async function getAdminPrompts() {
  const res = await apiFetch('/api/admin/prompts');
  const data = await handleResponse(res);
  return Array.isArray(data.prompts) ? data.prompts : [];
}

export async function createAdminPrompt(payload) {
  const res = await apiFetch('/api/admin/prompts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateAdminPrompt(id, payload) {
  const res = await apiFetch(`/api/admin/prompts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteAdminPrompt(id) {
  const res = await apiFetch(`/api/admin/prompts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

/**
 * Participant Distress Thermometer submission.
 * Persists every score. High scores suspend chat server-side (no admin role required).
 */
export async function submitDistressScore(score, extra = {}) {
  const payload = {
    score,
    message: extra.message || '',
    context: extra.context || { source: 'thermometer' },
  };
  const res = await apiFetch('/api/distress', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}
