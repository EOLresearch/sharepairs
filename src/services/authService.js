/**
 * Auth service — all auth operations via REST.
 * Uses REACT_APP_API_URL when set (API Gateway); otherwise same-origin /api.
 * Stores the stub/JWT token in sessionStorage and sends Authorization: Bearer.
 */

const API_ROOT = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
const AUTH_BASE = `${API_ROOT}/api/auth`;
const TOKEN_KEY = 'authToken';

export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.code || data?.details?.code;
    if (!err.code && typeof data?.error === 'string' && data.error.startsWith('auth/')) {
      err.code = data.error;
    }
    throw err;
  }
  return data;
}

/**
 * Login with email and password.
 * Returns { user, token } or similar from backend.
 */
export async function login(email, password) {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  const data = await handleResponse(res);
  if (data?.token) setStoredToken(data.token);
  return data;
}

/**
 * Logout (clear session on server and client).
 */
export async function logout() {
  try {
    const res = await fetch(`${AUTH_BASE}/logout`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
    });
    if (!(res.ok || res.status === 404)) await handleResponse(res);
  } finally {
    setStoredToken(null);
  }
}

/**
 * Get session token for WebSocket authentication.
 */
export async function getWsToken() {
  const stored = getStoredToken();
  if (stored) return { token: stored };
  const res = await fetch(`${AUTH_BASE}/ws-token`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (res.status === 401) throw new Error('Not authenticated');
  return handleResponse(res);
}

/**
 * Get current authenticated user and profile.
 */
export async function getCurrentUser() {
  if (!getStoredToken()) return null;
  const res = await fetch(`${AUTH_BASE}/me`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (res.status === 401) {
    setStoredToken(null);
    return null;
  }
  const data = await handleResponse(res);
  return data?.user ? data : null;
}

/**
 * Register new user. Creates auth user and profile.
 */
export async function register(email, password, userDetails = {}, isAdmin = false) {
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, ...userDetails, isAdmin }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Send password reset email.
 */
export async function resetPassword(email) {
  const res = await fetch(`${AUTH_BASE}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

/**
 * Resend verification email for current user (or email in body).
 */
export async function resendVerificationEmail(email) {
  const res = await fetch(`${AUTH_BASE}/resend-verification`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(email ? { email } : {}),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Confirm email with a 6-digit verification code.
 */
export async function verifyEmail(code, email) {
  const res = await fetch(`${AUTH_BASE}/verify-email`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ code, ...(email ? { email } : {}) }),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Update current user profile (e.g. hasSeenMatch, displayName).
 */
export async function updateUserProfile(uid, patch) {
  const res = await fetch(`${AUTH_BASE}/me`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
    credentials: 'include',
  });
  return handleResponse(res);
}

/**
 * Add a contact to the current user if not already present.
 */
export async function addContactIfNotExists(userUid, contactObj) {
  if (!userUid || !contactObj?.uid) return;
  const res = await fetch(`${AUTH_BASE}/contacts`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ contact: contactObj }),
    credentials: 'include',
  });
  if (res.status === 404 || res.status === 501) return;
  return handleResponse(res);
}
