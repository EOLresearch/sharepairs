/**
 * Match service — matches, conversations list, and conversation creation via REST.
 * Endpoints: /api/matches, /api/conversations, /api/consent/request (for requestConversation)
 */

const MATCHES_BASE = '/api/matches';
const CONVERSATIONS_BASE = '/api/conversations';

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
 * Get current user's match (and/or list of matches). One-shot.
 */
export async function getMatches() {
  const res = await fetch(MATCHES_BASE, { credentials: 'include' });
  return handleResponse(res);
}

/**
 * Request a conversation with a match (creates consent request).
 * matchId is the other user's uid.
 */
export async function requestConversation(matchId) {
  const res = await fetch('/api/consent/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId }),
    credentials: 'include',
  });
  return handleResponse(res);
}

const CONVERSATIONS_POLL_MS = 5000;

/**
 * Get list of conversations for the current user. One-shot.
 */
export async function getConversations() {
  const res = await fetch(CONVERSATIONS_BASE, { credentials: 'include' });
  const data = await handleResponse(res);
  return Array.isArray(data.conversations) ? data.conversations : data;
}

/**
 * Polling: subscribe to conversations list. Returns unsubscribe.
 */
export function listenToConversations(callback) {
  if (typeof callback !== 'function') return () => {};
  let cancelled = false;
  const poll = async () => {
    if (cancelled) return;
    try {
      const list = await getConversations();
      if (!cancelled && Array.isArray(list)) callback(list);
    } catch (err) {
      if (!cancelled) console.warn('matchService.listenToConversations poll error:', err);
    }
    if (!cancelled) setTimeout(poll, CONVERSATIONS_POLL_MS);
  };
  poll();
  return () => { cancelled = true; };
}

/**
 * Create or get existing conversation between two users (initiator + other).
 * Returns { docID, ...conversation } or { conversation: {...}, created }.
 */
export async function createConversation(initiatorUid, otherUid) {
  const res = await fetch(CONVERSATIONS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initiatorUid, otherUid }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Create or get support conversation for current user.
 */
export async function createSupportConvoIfMissing(userUid) {
  const res = await fetch(`${CONVERSATIONS_BASE}/support`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userUid }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Get existing support conversation if any.
 */
export async function getSupportConvoIfExists(userUid) {
  const res = await fetch(
    `${CONVERSATIONS_BASE}/support?userUid=${encodeURIComponent(userUid)}`,
    { credentials: 'include' }
  );
  if (res.status === 404) return null;
  return handleResponse(res);
}

// ——— Admin ———

/**
 * Get all users (admin). One-shot.
 */
export async function getAllUsers() {
  const res = await fetch('/api/admin/users', { credentials: 'include' });
  const data = await handleResponse(res);
  return Array.isArray(data.users) ? data.users : data;
}

/**
 * Get all conversations (admin). One-shot.
 */
export async function getAllConversations() {
  const res = await fetch('/api/admin/conversations', { credentials: 'include' });
  const data = await handleResponse(res);
  return Array.isArray(data.conversations) ? data.conversations : data;
}

/**
 * Set match between two users (admin).
 */
export async function updateMatch(uid, matchUid) {
  const res = await fetch('/api/admin/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, matchUid }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Remove match for a user (admin).
 */
export async function removeMatch(uid) {
  const res = await fetch('/api/admin/matches/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Enable chat for user (admin).
 */
export async function enableChatForUser(uid) {
  const res = await fetch('/api/admin/chat/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Disable chat for user (admin).
 */
export async function disableChatForUser(uid) {
  const res = await fetch('/api/admin/chat/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Send distress alert email (and optionally log).
 */
export async function sendDistressAlertEmail(userData, level) {
  const res = await fetch('/api/distress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, user: userData }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Log distress selection for a user.
 */
export async function logDistressSelection(uid, level) {
  if (!uid || typeof level !== 'number') return;
  await fetch('/api/distress/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, level }),
    credentials: 'include',
  });
}
