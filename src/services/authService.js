/**
 * Auth service — all auth operations via REST.
 * Endpoints: /api/auth/login, /api/auth/logout, /api/auth/me, /api/auth/register, /api/auth/reset-password
 */

const AUTH_BASE = '/api/auth';

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
  return handleResponse(res);
}

/**
 * Logout (clear session on server and/or client).
 */
export async function logout() {
  const res = await fetch(`${AUTH_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (res.ok || res.status === 404) return;
  return handleResponse(res);
}

/**
 * Get current authenticated user and profile.
 * Returns { user: { uid, email, emailVerified, ... }, userData: { authId, displayName, ... } } or null.
 */
export async function getCurrentUser() {
  const res = await fetch(`${AUTH_BASE}/me`, {
    method: 'GET',
    credentials: 'include',
  });
  if (res.status === 401) return null;
  const data = await handleResponse(res);
  return data?.user ? data : null;
}

/**
 * Register new user. Creates auth user and profile.
 * Returns { success, user } or throws.
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
 * Resend verification email for current user.
 */
export async function resendVerificationEmail() {
  const res = await fetch(`${AUTH_BASE}/resend-verification`, {
    method: 'POST',
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact: contactObj }),
    credentials: 'include',
  });
  if (res.status === 404 || res.status === 501) return;
  return handleResponse(res);
}
