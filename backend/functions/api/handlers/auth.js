import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, updateItem } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import { stubLogin, toUserData } from '../../../shared/stubAuth.js';
import { config } from '../../../shared/config.js';

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { user, userData, token } (stub) or { user, userData } (Cognito - token in Set-Cookie)
 */
export async function login(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }
  const email = body.email && String(body.email).trim();
  const password = body.password;
  if (!email || password === undefined) {
    return error('email and password required', 400);
  }

  if (config.stubAuth) {
    const result = await stubLogin(email, password);
    if (!result) return error('Invalid credentials', 401);
    const res = success({
      user: result.user,
      userData: result.userData,
      token: result.token,
    });
    res.headers = res.headers || {};
    res.headers['Set-Cookie'] = `authToken=${encodeURIComponent(result.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
    return res;
  }

  // Cognito: stub for now — return 501
  return error('Use Cognito for production login', 501);
}

/**
 * GET /api/auth/me
 * Returns: { user, userData } or 401
 */
export async function me(event) {
  try {
    const auth = await authenticateUser(event);
    const user = {
      uid: auth.userId,
      email: auth.email,
      emailVerified: auth.email_verified !== false,
    };
    const userData = auth.userData || toUserData(auth);
    return success({ user, userData });
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
}

/**
 * PATCH /api/auth/me — update current user profile
 */
export async function mePatch(event) {
  try {
    const auth = await authenticateUser(event);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const updates = { updated_at: Date.now() };
    if (body.hasSeenMatch !== undefined) updates.has_seen_match = !!body.hasSeenMatch;
    if (body.displayName !== undefined) updates.display_name = body.displayName;
    if (body.photoURL !== undefined) updates.photo_url = body.photoURL;
    if (Object.keys(updates).length === 1) {
      return success({ user: { uid: auth.userId }, userData: auth.userData || toUserData(auth) });
    }
    await updateItem(TABLES.USERS, { id: auth.userId }, updates);
    const user = await getItem(TABLES.USERS, { id: auth.userId });
    return success({ user: { uid: user.id }, userData: toUserData(user) });
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
}