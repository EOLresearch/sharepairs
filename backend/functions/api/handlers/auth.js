import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, updateItem } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import {
  stubLogin,
  stubRegister,
  stubResendVerification,
  stubConfirmVerification,
  toUserData,
} from '../../../shared/stubAuth.js';
import { config } from '../../../shared/config.js';
import { schemas, validate } from '../../../shared/validation.js';

/**
 * POST /api/auth/register
 * Body: { email, password, displayName, ...profile }
 * Returns: { userSub, needsConfirmation, user, userData }
 */
export async function register(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }

  let validated;
  try {
    validated = validate(schemas.register, body);
  } catch (err) {
    return error(err.message || 'Validation error', 400, { code: 'auth/invalid-argument' });
  }

  if (config.stubAuth) {
    try {
      const result = await stubRegister(validated);
      return success(result, 201);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        return error(err.message, 409, { code: err.code });
      }
      return error(err.message || 'Registration failed', 400, { code: err.code });
    }
  }

  // Cognito SignUp + DynamoDB profile — next when STUB_AUTH is off
  return error('Use Cognito for production registration', 501, { code: 'auth/not-implemented' });
}

/**
 * POST /api/auth/resend-verification
 * Auth optional: uses session user, or body.email
 */
export async function resendVerification(event) {
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }

  let userId = null;
  try {
    const auth = await authenticateUser(event);
    userId = auth.userId;
  } catch {
    // allow unauthenticated resend by email
  }

  const email = body.email && String(body.email).trim();
  if (!userId && !email) {
    return error('Authentication or email required', 400, { code: 'auth/invalid-argument' });
  }

  if (config.stubAuth) {
    try {
      const result = await stubResendVerification({ userId, email });
      return success({
        message: result.alreadyVerified
          ? 'Email already verified'
          : 'Verification code sent',
        ...result,
      });
    } catch (err) {
      // Avoid email enumeration for unauthenticated calls
      if (!userId && err.code === 'auth/user-not-found') {
        return success({ message: 'If an account exists, a verification code was sent' });
      }
      return error(err.message || 'Resend failed', 400, { code: err.code });
    }
  }

  return error('Use Cognito for production verification', 501, { code: 'auth/not-implemented' });
}

/**
 * POST /api/auth/verify-email
 * Body: { code, email? } — email optional when authenticated
 */
export async function verifyEmail(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }

  let validated;
  try {
    validated = validate(schemas.verifyEmail, body);
  } catch (err) {
    return error(err.message || 'Validation error', 400, { code: 'auth/invalid-argument' });
  }

  let userId = null;
  try {
    const auth = await authenticateUser(event);
    userId = auth.userId;
  } catch {
    // allow confirm by email + code without session
  }

  if (!userId && !validated.email) {
    return error('Authentication or email required', 400, { code: 'auth/invalid-argument' });
  }

  if (config.stubAuth) {
    try {
      const result = await stubConfirmVerification({
        userId,
        email: validated.email,
        code: validated.code,
      });
      return success({
        message: result.alreadyVerified ? 'Email already verified' : 'Email verified',
        user: result.user,
        userData: result.userData,
      });
    } catch (err) {
      const status = err.code === 'auth/user-not-found' ? 404 : 400;
      return error(err.message || 'Verification failed', status, { code: err.code });
    }
  }

  return error('Use Cognito for production verification', 501, { code: 'auth/not-implemented' });
}

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
    res.headers['Set-Cookie'] = `authToken=${encodeURIComponent(result.token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=86400`;
    return res;
  }

  // Cognito: stub for now — return 501
  return error('Use Cognito for production login', 501);
}

/**
 * POST /api/auth/logout — clear auth cookie
 */
export async function logout() {
  const res = success({ message: 'Logged out' });
  res.headers = res.headers || {};
  res.headers['Set-Cookie'] =
    'authToken=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
  return res;
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
      // Missing field (legacy seeds) counts as verified; explicit false does not
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
