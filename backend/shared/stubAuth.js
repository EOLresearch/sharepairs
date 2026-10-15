/**
 * Stub auth for local/dev: validate email+password against users table,
 * issue a simple JWT-like token (or opaque token) so GET /api/auth/me can resolve user.
 * For production, replace with Cognito; keep this behind STUB_AUTH=true only.
 */
import { query, putItem, updateItem, getItem, deleteItem } from './database.js';
import { TABLES } from './database.js';
import { sendVerificationEmail } from './email.js';
import { isLocalEnv, normalizeAuthIdentity } from './env.js';
import { consumeInvite, isInviteRecord, normalizeInviteCode, requireInviteCode } from './invites.js';
import { intakeSurveyIsComplete, recordIntakeSurvey } from './assessments/service.js';
import { demoTutorialEnabled, DEMO_PARTICIPANT_ID } from './demoTutorial.js';
import crypto from 'crypto';

const RETIRED_STUB_SECRETS = new Set([
  'sharepairs-dev-launch',
  'dev-secret-change-in-prod',
  'unset-set-via-wire-api',
]);
const TOKEN_PREFIX = 'stub_';
const VERIFY_CODE_TTL_MS = 15 * 60 * 1000;
export const STUB_TOKEN_TTL_SECONDS = 24 * 60 * 60;

function resolveStubSecret() {
  const raw = String(process.env.STUB_AUTH_SECRET || '');
  if (RETIRED_STUB_SECRETS.has(raw)) {
    throw new Error('STUB_AUTH_SECRET is a retired committed value; set a new secret');
  }
  if (raw) return raw;
  if (isLocalEnv()) return 'dev-secret-local';
  throw new Error('STUB_AUTH_SECRET is required');
}

const STUB_SECRET = resolveStubSecret();

/** Study default: skip emailed codes and land in the app after register/login. */
export function requireEmailVerification() {
  const raw = String(process.env.REQUIRE_EMAIL_VERIFICATION ?? 'false').toLowerCase().trim();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function hashValue(value) {
  return crypto.createHmac('sha256', STUB_SECRET).update(String(value)).digest('hex');
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Issue (or re-issue) an email verification code for a user row.
 * Returns { code, emailDelivery }.
 */
export async function issueEmailVerification(user) {
  const code = generateVerificationCode();
  const now = Date.now();
  await updateItem(TABLES.USERS, { id: user.id }, {
    email_verification_hash: hashValue(code),
    email_verification_expires: now + VERIFY_CODE_TTL_MS,
    updated_at: now,
  });
  const emailDelivery = await sendVerificationEmail(user.email, code);
  return { code, emailDelivery };
}

/**
 * Find user by email (requires GSI on users: email-index, pk = email).
 * If no GSI, scan by email (ok for dev only).
 */
export async function findUserByEmail(email) {
  const norm = normalizeAuthIdentity(email);
  if (!norm) return null;
  // Prefer GSI query if table has email as GSI key
  try {
    const items = await query(TABLES.USERS, {
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': norm },
    });
    return (items || []).find((u) => !isInviteRecord(u)) || null;
  } catch (e) {
    // Fallback: scan (dev only)
    const { scan } = await import('./database.js');
    const all = await scan(TABLES.USERS);
    return all.find((u) => !isInviteRecord(u) && (u.email || '').toLowerCase() === norm) || null;
  }
}

export function hashPassword(password) {
  const computed = crypto.createHmac('sha256', STUB_SECRET).update(password).digest('hex');
  return `hmac-sha256:${computed}`;
}

/**
 * Verify password (stub: compare with stored password_hash or plaintext password in dev).
 */
function checkPassword(user, password) {
  if (!user || !password) return false;
  if (user.access_code && !user.password_changed_at && String(password) === String(user.access_code)) {
    return true;
  }
  const hash = user.password_hash;
  if (hash) {
    const [, ...rest] = hash.split(':');
    const computed = crypto.createHmac('sha256', STUB_SECRET).update(password).digest('hex');
    return rest.join(':') === computed;
  }
  return user.password === password;
}

/**
 * Replace the access-code password. The code stops working after this.
 */
export async function stubChangePassword(userId, currentPassword, newPassword) {
  const user = await getItem(TABLES.USERS, { id: userId });
  if (!user || isInviteRecord(user)) {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'auth/user-not-found';
    throw err;
  }
  if (!checkPassword(user, currentPassword)) {
    const err = new Error('Current password is incorrect');
    err.status = 401;
    err.code = 'auth/wrong-password';
    throw err;
  }
  if (String(newPassword) === String(currentPassword)) {
    const err = new Error('Choose a different password');
    err.status = 400;
    err.code = 'auth/invalid-argument';
    throw err;
  }
  const now = Date.now();
  await updateItem(TABLES.USERS, { id: userId }, {
    password_hash: hashPassword(newPassword),
    access_code: null,
    password_changed_at: now,
    updated_at: now,
  });
  if (user.screener_id) {
    try {
      await updateItem(TABLES.SCREENERS, { id: user.screener_id }, {
        password_changed: true,
        updated_at: now,
      });
    } catch (err) {
      console.warn('[stubChangePassword] screener update failed:', err?.message || err);
    }
  }
  return { ok: true };
}

function adminEmailsFromEnv() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Map registration body (camelCase from frontend) onto DynamoDB user attributes.
 * Never trusts client isAdmin / admin flags. Admin is explicit config only.
 */
export function buildUserProfileFromRegister(body, { id, email, passwordHash, now }) {
  const str = (v) => (v === undefined || v === null ? undefined : String(v).trim());
  const optional = (key, value) => {
    const s = str(value);
    if (s) return { [key]: s };
    return {};
  };

  return {
    id,
    email,
    password_hash: passwordHash,
    display_name: str(body.displayName) || email.split('@')[0],
    photo_url: str(body.photoURL) || '',
    preferred_language: 'en',
    timezone: str(body.timezone) || 'UTC',
    is_admin: false,
    email_verified: !requireEmailVerification(),
    study_consent: body.consent === true || body.consent === 'true',
    contacts: [],
    chat_disabled: false,
    has_seen_match: false,
    simpatico_match: null,
    created_at: now,
    updated_at: now,
    ...optional('country', body.country),
    ...optional('residence', body.residence),
    ...optional('birth_date', body.birthDate),
    ...optional('race', body.race),
    ...optional('ethnicity', body.ethnicity),
    ...optional('bio_sex', body.bioSex),
    ...optional('education', body.education),
    ...optional('household', body.household),
    ...optional('hobbies', body.hobbies),
    ...optional('loss_date', body.lossDate),
    ...optional('kinship', body.kinship),
    ...optional('cause', body.cause),
    ...optional('deceased_age', body.deceasedAge),
    ...optional('loss_exp', body.lossExp),
  };
}

/**
 * Lookup key for the separate eligibility-screener project.
 * The account email is the only identifier this app stores for a later match.
 * A shared address does not confirm eligibility or screener consent, and this
 * function does not read the screener database.
 */
export function screeningRecordLink(email) {
  const key = normalizeAuthIdentity(email);
  return {
    email: key || null,
    source: 'account_email',
    eligibilityConfirmed: false,
    screenerConsentConfirmed: false,
  };
}

/**
 * Stub register: create user in DynamoDB. Throws Error with code auth/email-already-in-use.
 */
export async function stubRegister(body) {
  const email = normalizeAuthIdentity(body.email);
  const password = body.password;
  if (!email || !password) {
    const err = new Error('email and password required');
    err.code = 'auth/invalid-argument';
    throw err;
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    const err = new Error('Email already in use');
    err.code = 'auth/email-already-in-use';
    throw err;
  }

  // Study Support is provisioned separately — do not allow normal registration on that mailbox
  const supportEmail = String(process.env.SUPPORT_EMAIL || 'eolstudysupport@med.cornell.edu')
    .toLowerCase()
    .trim();
  if (email === supportEmail) {
    const err = new Error('This email is reserved for Study Support. Please sign in instead.');
    err.code = 'auth/email-already-in-use';
    throw err;
  }

  if (requireInviteCode() && !normalizeInviteCode(body.inviteCode)) {
    const err = new Error('Invite code is invalid or already used.');
    err.code = 'auth/invalid-invite';
    err.status = 403;
    throw err;
  }

  const demoSignup = demoTutorialEnabled() && email === 'demo@local';
  const id = demoSignup ? DEMO_PARTICIPANT_ID : crypto.randomUUID();
  const now = Date.now();
  const item = buildUserProfileFromRegister(body, {
    id,
    email,
    passwordHash: hashPassword(password),
    now,
  });
  if (demoSignup) {
    item.email_verified = true;
    item.is_admin = false;
    item.is_support = false;
  }

  await putItem(TABLES.USERS, item);

  if (requireInviteCode()) {
    try {
      await consumeInvite(body.inviteCode, id);
    } catch (err) {
      await deleteItem(TABLES.USERS, { id });
      throw err;
    }
  }

  try {
    if (intakeSurveyIsComplete(body)) {
      await recordIntakeSurvey(id, body);
    }
  } catch (err) {
    console.error('[stubRegister] intake survey failed:', err?.message || err);
    await deleteItem(TABLES.USERS, { id });
    throw err;
  }

  const token = signStubToken(id);
  const screeningLink = screeningRecordLink(email);
  const verified = item.email_verified === true;

  // Optional emailed codes — off by default for study (REQUIRE_EMAIL_VERIFICATION=true to enable)
  if (requireEmailVerification() && !verified) {
    const { code, emailDelivery } = await issueEmailVerification(item);
    return {
      userSub: id,
      needsConfirmation: true,
      user: {
        uid: id,
        email,
        emailVerified: false,
      },
      userData: toUserData({ ...item, email_verified: false }),
      token,
      screeningLink,
      emailDelivery,
      ...(!emailDelivery?.sent ? { devCode: code } : {}),
    };
  }

  return {
    userSub: id,
    needsConfirmation: false,
    user: {
      uid: id,
      email,
      emailVerified: true,
    },
    userData: toUserData({ ...item, email_verified: true }),
    token,
    screeningLink,
  };
}

/**
 * Resend verification for a user by id or email. No-ops if already verified.
 */
export async function stubResendVerification({ userId, email }) {
  let user = null;
  if (userId) {
    user = await getItem(TABLES.USERS, { id: userId });
  } else if (email) {
    user = await findUserByEmail(email);
  }
  if (!user) {
    const err = new Error('User not found');
    err.code = 'auth/user-not-found';
    throw err;
  }
  if (user.email_verified === true) {
    return { alreadyVerified: true, email: user.email };
  }
  const { code, emailDelivery } = await issueEmailVerification(user);
  return {
    alreadyVerified: false,
    email: user.email,
    emailDelivery,
    ...(!emailDelivery?.sent ? { devCode: code } : {}),
  };
}

/**
 * Confirm email with a 6-digit code.
 */
export async function stubConfirmVerification({ userId, email, code }) {
  let user = null;
  if (userId) {
    user = await getItem(TABLES.USERS, { id: userId });
  } else if (email) {
    user = await findUserByEmail(email);
  }
  if (!user) {
    const err = new Error('User not found');
    err.code = 'auth/user-not-found';
    throw err;
  }
  if (user.email_verified === true) {
    return { alreadyVerified: true, user: { uid: user.id, email: user.email, emailVerified: true }, userData: toUserData(user) };
  }

  const raw = String(code || '').trim();
  if (!/^\d{6}$/.test(raw)) {
    const err = new Error('Invalid verification code');
    err.code = 'auth/invalid-verification-code';
    throw err;
  }
  if (!user.email_verification_hash || !user.email_verification_expires) {
    const err = new Error('No verification code pending; request a new one');
    err.code = 'auth/no-verification-code';
    throw err;
  }
  if (Date.now() > Number(user.email_verification_expires)) {
    const err = new Error('Verification code expired');
    err.code = 'auth/code-expired';
    throw err;
  }
  if (hashValue(raw) !== user.email_verification_hash) {
    const err = new Error('Invalid verification code');
    err.code = 'auth/invalid-verification-code';
    throw err;
  }

  const now = Date.now();
  const updated = await updateItem(TABLES.USERS, { id: user.id }, {
    email_verified: true,
    email_verification_hash: null,
    email_verification_expires: null,
    updated_at: now,
  });
  return {
    alreadyVerified: false,
    user: { uid: updated.id, email: updated.email, emailVerified: true },
    userData: toUserData(updated),
  };
}

/**
 * Create stub token (payload.sub = userId). In prod use Cognito JWT.
 */
function signStubToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, iat: now, exp: now + STUB_TOKEN_TTL_SECONDS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STUB_SECRET).update(payloadB64).digest('base64url');
  return TOKEN_PREFIX + payloadB64 + '.' + sig;
}

/**
 * Verify stub token and return payload.
 */
export function verifyStubToken(token) {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const part = token.slice(TOKEN_PREFIX.length);
  const [payloadB64, sig] = part.split('.');
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', STUB_SECRET).update(payloadB64).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    // Return just the userId (sub) so callers can use it directly as the DynamoDB key.
    return payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Stub login: validate email/password, return { user, token }.
 */
export async function stubLogin(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !checkPassword(user, password)) {
    return null;
  }
  const uid = user.id || user.uid;
  if (!uid) return null;

  // Study ops: promote listed emails to admin (comma-separated ADMIN_EMAILS env).
  const adminEmails = adminEmailsFromEnv();
  const emailNorm = String(user.email || '').toLowerCase();
  const shouldBeAdmin = adminEmails.includes(emailNorm);
  if (shouldBeAdmin && !user.is_admin) {
    await updateItem(TABLES.USERS, { id: uid }, {
      is_admin: true,
      updated_at: Date.now(),
    });
    user.is_admin = true;
  }

  // Demo tutorial account only: skip the email gate when DEMO_TUTORIAL is on.
  // Other accounts still follow REQUIRE_EMAIL_VERIFICATION.
  if (
    demoTutorialEnabled()
    && uid === DEMO_PARTICIPANT_ID
    && requireEmailVerification()
    && user.email_verified === false
  ) {
    await updateItem(TABLES.USERS, { id: uid }, {
      email_verified: true,
      email_verification_hash: null,
      email_verification_expires: null,
      is_admin: false,
      is_support: false,
      updated_at: Date.now(),
    });
    user.email_verified = true;
    user.is_admin = false;
    user.is_support = false;
  }

  // Study mode: clear the verify gate for anyone who already registered before we turned it off
  if (!requireEmailVerification() && user.email_verified === false) {
    await updateItem(TABLES.USERS, { id: uid }, {
      email_verified: true,
      email_verification_hash: null,
      email_verification_expires: null,
      updated_at: Date.now(),
    });
    user.email_verified = true;
  }

  const token = signStubToken(uid);
  return {
    user: {
      uid,
      email: user.email,
      emailVerified: user.email_verified !== false,
    },
    userData: toUserData(user),
    token,
  };
}

/**
 * Normalize DB user to frontend userData shape.
 */
export function toUserData(row) {
  if (!row || isInviteRecord(row)) return null;
  const id = row.id || row.uid;
  return {
    authId: id,
    uid: id,
    email: row.email,
    displayName: row.display_name || row.displayName || '',
    photoURL: row.photo_url || row.photoURL || '',
    preferredLanguage: row.preferred_language || row.preferredLanguage || 'en',
    timezone: row.timezone || 'UTC',
    admin: Boolean(row.is_admin || row.admin),
    isSupport: Boolean(row.is_support || row.isSupport),
    simpaticoMatch: row.simpatico_match || row.simpaticoMatch || null,
    contacts: row.contacts || [],
    chatDisabled: Boolean(row.chat_disabled || row.chatDisabled),
    hasSeenMatch: Boolean(row.has_seen_match || row.hasSeenMatch),
    matchNoticeSeen: row.match_notice_seen === false
      ? false
      : row.match_notice_seen === true
        ? true
        : null,
    country: row.country || '',
    residence: row.residence || '',
    birthDate: row.birth_date || row.birthDate || '',
    race: row.race || '',
    ethnicity: row.ethnicity || '',
    bioSex: row.bio_sex || row.bioSex || '',
    education: row.education || '',
    household: row.household || '',
    hobbies: row.hobbies || '',
    lossDate: row.loss_date || row.lossDate || '',
    kinship: row.kinship || '',
    cause: row.cause || '',
    deceasedAge: row.deceased_age || row.deceasedAge || '',
    lossExp: row.loss_exp || row.lossExp || '',
    studyConsent: Boolean(row.study_consent || row.studyConsent),
    usingAccessCode: Boolean(row.access_code) && !row.password_changed_at,
  };
}
