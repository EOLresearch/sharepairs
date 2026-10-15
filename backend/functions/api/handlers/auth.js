import { success, error } from '../../../shared/response.js';
import { syncProfileIntoOpenAssessments } from '../../../shared/assessments/service.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, updateItem } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import {
  stubLogin,
  stubRegister,
  stubResendVerification,
  stubConfirmVerification,
  stubChangePassword,
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
      const res = success(result, 201);
      if (result.token) {
        res.headers = res.headers || {};
        res.headers['Set-Cookie'] = `authToken=${encodeURIComponent(result.token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=86400`;
      }
      return res;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        return error(err.message, 409, { code: err.code });
      }
      if (err.code === 'auth/invalid-invite') {
        return error(err.message, 403, { code: err.code });
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
    if (!result) return error('Invalid credentials', 401, { code: 'auth/wrong-password' });
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
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * The access code counts as the current password until it is replaced.
 */
export async function changePassword(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error('Invalid JSON', 400);
  }

  let auth;
  try {
    auth = await authenticateUser(event);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }

  let validated;
  try {
    validated = validate(schemas.changePassword, body);
  } catch (err) {
    return error(err.message || 'Validation error', 400, { code: 'auth/invalid-argument' });
  }

  if (!config.stubAuth) {
    return error('Use Cognito for production password changes', 501, { code: 'auth/not-implemented' });
  }

  try {
    await stubChangePassword(auth.userId, validated.currentPassword, validated.newPassword);
    return success({ ok: true });
  } catch (err) {
    return error(err.message || 'Could not change password', err.status || 400, { code: err.code });
  }
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
      // Explicit false = unverified; missing (legacy seeds) = verified
      emailVerified: auth.email_verified === false ? false : true,
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
const PROFILE_PATCH_FIELDS = {
  hasSeenMatch: { key: 'has_seen_match', type: 'bool' },
  matchNoticeSeen: { key: 'match_notice_seen', type: 'bool' },
  displayName: { key: 'display_name', type: 'string', max: 100 },
  photoURL: { key: 'photo_url', type: 'string', max: 500 },
  residence: { key: 'residence', type: 'string', max: 100 },
  birthDate: { key: 'birth_date', type: 'string', max: 32 },
  race: { key: 'race', type: 'string', max: 100 },
  ethnicity: { key: 'ethnicity', type: 'string', max: 100 },
  bioSex: { key: 'bio_sex', type: 'string', max: 100 },
  education: { key: 'education', type: 'string', max: 100 },
  household: { key: 'household', type: 'string', max: 100 },
  hobbies: { key: 'hobbies', type: 'string', max: 2000 },
  lossDate: { key: 'loss_date', type: 'string', max: 32 },
  kinship: { key: 'kinship', type: 'string', max: 100 },
  cause: { key: 'cause', type: 'string', max: 100 },
  deceasedAge: { key: 'deceased_age', type: 'string', max: 10 },
  lossExp: { key: 'loss_exp', type: 'string', max: 5000 },
};

const PARTNER_VISIBLE_KEYS = new Set(['display_name', 'photo_url', 'residence', 'loss_exp']);

function matchUidOf(user) {
  if (!user) return null;
  const m = user.simpatico_match ?? user.simpaticoMatch;
  if (!m) return null;
  if (typeof m === 'string') return m || null;
  return m.uid || m.authId || null;
}

function isAtLeast18(birthDateStr) {
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 18;
}

async function syncPartnerFacingProfile(user, updates) {
  const touched = Object.keys(updates).some((k) => PARTNER_VISIBLE_KEYS.has(k));
  if (!touched) return;
  const partnerUid = matchUidOf(user);
  if (!partnerUid) return;
  const partner = await getItem(TABLES.USERS, { id: partnerUid });
  if (!partner) return;

  const nextDisplay = updates.display_name ?? user.display_name ?? user.displayName ?? '';
  const nextPhoto = updates.photo_url ?? user.photo_url ?? user.photoURL ?? '';
  const nextResidence = updates.residence ?? user.residence ?? '';
  const nextLoss = updates.loss_exp ?? user.loss_exp ?? user.lossExp ?? '';

  const contacts = (Array.isArray(partner.contacts) ? partner.contacts : []).map((c) => {
    if (c?.uid !== user.id && c?.authId !== user.id) return c;
    return {
      ...c,
      displayName: nextDisplay,
      photoURL: nextPhoto,
      residence: nextResidence,
      lossExp: nextLoss,
    };
  });

  const patch = { contacts, updated_at: Date.now() };
  const match = partner.simpatico_match ?? partner.simpaticoMatch;
  if (match && typeof match === 'object' && (match.uid === user.id || match.authId === user.id)) {
    patch.simpatico_match = {
      ...match,
      displayName: nextDisplay,
      photoURL: nextPhoto,
    };
  }
  await updateItem(TABLES.USERS, { id: partnerUid }, patch);
}

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
    for (const [from, spec] of Object.entries(PROFILE_PATCH_FIELDS)) {
      if (body[from] === undefined) continue;
      if (spec.type === 'bool') {
        updates[spec.key] = !!body[from];
        continue;
      }
      const raw = body[from] == null ? '' : String(body[from]).trim();
      updates[spec.key] = raw.slice(0, spec.max || 500);
    }
    if (updates.birth_date && !isAtLeast18(updates.birth_date)) {
      return error('Must be 18 or older', 400);
    }
    if (Object.keys(updates).length === 1) {
      return success({ user: { uid: auth.userId }, userData: auth.userData || toUserData(auth) });
    }
    const existing = await getItem(TABLES.USERS, { id: auth.userId });
    if (!existing) return error('User not found', 404);
    await updateItem(TABLES.USERS, { id: auth.userId }, updates);
    try {
      await syncPartnerFacingProfile(existing, updates);
    } catch (err) {
      console.warn('[auth.mePatch] partner profile sync failed:', err?.message || err);
    }
    const user = await getItem(TABLES.USERS, { id: auth.userId });
    try {
      await syncProfileIntoOpenAssessments(user, Object.keys(updates));
    } catch (err) {
      console.warn('[auth.mePatch] assessment profile sync failed:', err?.message || err);
    }
    return success({ user: { uid: user.id }, userData: toUserData(user) });
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
}

/**
 * POST /api/auth/contacts — add a contact if not already present
 * Body: { contact: { uid, displayName, photoURL, type, ... } }
 */
export async function addContact(event) {
  try {
    const auth = await authenticateUser(event);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const contact = body.contact || body;
    const contactUid = contact?.uid || contact?.authId;
    if (!contactUid) return error('contact.uid required', 400);

    const user = await getItem(TABLES.USERS, { id: auth.userId });
    if (!user) return error('User not found', 404);

    const contacts = Array.isArray(user.contacts) ? [...user.contacts] : [];
    const exists = contacts.some((c) => c?.uid === contactUid || c?.authId === contactUid);
    if (!exists) {
      contacts.push({
        uid: contactUid,
        displayName: contact.displayName || contact.display_name || 'Contact',
        photoURL: contact.photoURL || contact.photo_url || '',
        type: contact.type || 'contact',
        residence: contact.residence || '',
        lossExp: contact.lossExp || contact.loss_exp || '',
      });
      await updateItem(TABLES.USERS, { id: auth.userId }, {
        contacts,
        updated_at: Date.now(),
      });
    }

    const updated = await getItem(TABLES.USERS, { id: auth.userId });
    return success({
      ok: true,
      added: !exists,
      user: { uid: auth.userId },
      userData: toUserData(updated),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
}
