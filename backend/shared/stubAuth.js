/**
 * Stub auth for local/dev: validate email+password against users table,
 * issue a simple JWT-like token (or opaque token) so GET /api/auth/me can resolve user.
 * For production, replace with Cognito; keep this behind STUB_AUTH=true only.
 */
import { query, putItem, updateItem, getItem } from './database.js';
import { TABLES } from './database.js';
import { sendVerificationEmail } from './email.js';
import crypto from 'crypto';

const STUB_SECRET = process.env.STUB_AUTH_SECRET || 'dev-secret-change-in-prod';
const TOKEN_PREFIX = 'stub_';
const VERIFY_CODE_TTL_MS = 15 * 60 * 1000;

function hashValue(value) {
  return crypto.createHmac('sha256', STUB_SECRET).update(String(value)).digest('hex');
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Issue (or re-issue) an email verification code for a user row.
 * Returns plaintext code for optional stub/dev response only.
 */
export async function issueEmailVerification(user) {
  const code = generateVerificationCode();
  const now = Date.now();
  await updateItem(TABLES.USERS, { id: user.id }, {
    email_verification_hash: hashValue(code),
    email_verification_expires: now + VERIFY_CODE_TTL_MS,
    updated_at: now,
  });
  await sendVerificationEmail(user.email, code);
  return code;
}

/**
 * Find user by email (requires GSI on users: email-index, pk = email).
 * If no GSI, scan by email (ok for dev only).
 */
export async function findUserByEmail(email) {
  const norm = String(email || '').toLowerCase().trim();
  if (!norm) return null;
  // Prefer GSI query if table has email as GSI key
  try {
    const items = await query(TABLES.USERS, {
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': norm },
    });
    return items[0] || null;
  } catch (e) {
    // Fallback: scan (dev only)
    const { scan } = await import('./database.js');
    const all = await scan(TABLES.USERS);
    return all.find((u) => (u.email || '').toLowerCase() === norm) || null;
  }
}

function hashPassword(password) {
  const computed = crypto.createHmac('sha256', STUB_SECRET).update(password).digest('hex');
  return `hmac-sha256:${computed}`;
}

/**
 * Verify password (stub: compare with stored password_hash or plaintext password in dev).
 */
function checkPassword(user, password) {
  if (!user || !password) return false;
  const hash = user.password_hash;
  if (hash) {
    const [, ...rest] = hash.split(':');
    const computed = crypto.createHmac('sha256', STUB_SECRET).update(password).digest('hex');
    return rest.join(':') === computed;
  }
  return user.password === password;
}

/**
 * Map registration body (camelCase from frontend) onto DynamoDB user attributes.
 * Never trusts client isAdmin / admin flags.
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
    preferred_language: body.preferredLanguage === 'tr' ? 'tr' : 'en',
    timezone: str(body.timezone) || 'UTC',
    is_admin: false,
    email_verified: true, // study app: no email provider required; participants can log in immediately
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
 * Stub register: create user in DynamoDB. Throws Error with code auth/email-already-in-use.
 */
export async function stubRegister(body) {
  const email = String(body.email || '').toLowerCase().trim();
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

  const id = crypto.randomUUID();
  const now = Date.now();
  const item = buildUserProfileFromRegister(body, {
    id,
    email,
    passwordHash: hashPassword(password),
    now,
  });

  await putItem(TABLES.USERS, item);

  return {
    userSub: id,
    needsConfirmation: false,
    user: {
      uid: id,
      email,
      emailVerified: true,
    },
    userData: toUserData(item),
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
  const code = await issueEmailVerification(user);
  return {
    alreadyVerified: false,
    email: user.email,
    ...(process.env.STUB_AUTH === 'true' ? { devCode: code } : {}),
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
  const payload = { sub: userId, iat: Math.floor(Date.now() / 1000) };
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
  if (!row) return null;
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
    simpaticoMatch: row.simpatico_match || row.simpaticoMatch || null,
    contacts: row.contacts || [],
    chatDisabled: Boolean(row.chat_disabled || row.chatDisabled),
    hasSeenMatch: Boolean(row.has_seen_match || row.hasSeenMatch),
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
  };
}
