/**
 * Eligible screener documents live in sharepairs-dev-screeners.
 * Submitting an eligible email creates the Share Pairs user there.
 * This module reads those rows for the study team and can finish a login
 * that the screener did not finish writing.
 */
import crypto from 'crypto';
import { getItem, putItem, updateItem, scan, TABLES } from './database.js';
import { findUserByEmail, hashPassword } from './stubAuth.js';
import { isInviteRecord } from './invites.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeAccessCode() {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function supportEmail() {
  return String(process.env.SUPPORT_EMAIL || 'eolstudysupport@med.cornell.edu').toLowerCase().trim();
}

function screenerEmail(row) {
  return String(row?.email || row?.sharepairs_profile?.email || '').trim().toLowerCase();
}

function profileFields(row) {
  const profile = row?.sharepairs_profile || {};
  const out = {};
  for (const key of [
    'country', 'residence', 'birth_date', 'race', 'ethnicity', 'bio_sex',
    'education', 'household', 'hobbies', 'kinship', 'cause',
  ]) {
    const text = profile[key] == null ? '' : String(profile[key]).trim();
    if (text) out[key] = text;
  }
  return out;
}

function passwordIsAccessCode(user) {
  return Boolean(user?.access_code) && !user.password_changed_at;
}

async function linkScreener(row, user, { accessCode, passwordChanged }) {
  const patch = {
    user_id: user.id,
    password_changed: Boolean(passwordChanged),
    updated_at: Date.now(),
  };
  if (accessCode) patch.access_code = accessCode;
  const changed = row.user_id !== user.id
    || Boolean(row.password_changed) !== Boolean(passwordChanged)
    || (accessCode && row.access_code !== accessCode);
  if (changed) await updateItem(TABLES.SCREENERS, { id: row.id }, patch);
}

/**
 * Create the participant login if this eligible screener does not have one yet.
 * Does not replace a password the participant already changed.
 */
export async function ensureAccountForScreener(row) {
  if (!row || row.type !== 'pilot_screener' || !row.eligible) {
    const err = new Error('Screener is not eligible');
    err.status = 400;
    throw err;
  }
  const email = screenerEmail(row);
  if (!email || !email.includes('@')) {
    const err = new Error('Eligible screener has no email');
    err.status = 400;
    throw err;
  }
  if (email === supportEmail()) {
    const err = new Error('That email is reserved for Study Support');
    err.status = 409;
    throw err;
  }

  const existing = await findUserByEmail(email);
  if (existing && !isInviteRecord(existing)) {
    const passwordChanged = !passwordIsAccessCode(existing);
    const accessCode = passwordChanged ? null : existing.access_code;
    await linkScreener(row, existing, { accessCode, passwordChanged });
    return { created: false, user: existing, accessCode, passwordChanged };
  }

  const code = String(row.access_code || '').trim() || makeAccessCode();
  const now = Date.now();
  const id = crypto.randomUUID();
  const user = {
    id,
    email,
    password_hash: hashPassword(code),
    access_code: code,
    display_name: email.split('@')[0] || email,
    photo_url: '',
    preferred_language: 'en',
    timezone: 'UTC',
    is_admin: false,
    is_support: false,
    email_verified: true,
    study_consent: true,
    contacts: [],
    chat_disabled: false,
    has_seen_match: false,
    simpatico_match: null,
    screener_id: row.id,
    created_at: now,
    updated_at: now,
    ...profileFields(row),
  };
  await putItem(TABLES.USERS, user);
  await linkScreener({ ...row, access_code: '' }, user, { accessCode: code, passwordChanged: false });
  return { created: true, user, accessCode: code, passwordChanged: false };
}

function toAdminRow(row, result, error) {
  return {
    id: row.id,
    email: result?.user?.email || screenerEmail(row),
    accessCode: result?.passwordChanged ? null : (result?.accessCode || null),
    passwordChanged: Boolean(result?.passwordChanged),
    accountReady: Boolean(result?.user?.id),
    userId: result?.user?.id || null,
    kinship: row.sharepairs_profile?.kinship || row.result?.kinship || '',
    createdAt: row.created_at || null,
    error: error || null,
  };
}

export async function listEligibleScreeners() {
  const rows = await scan(TABLES.SCREENERS);
  const eligible = rows
    .filter((row) => row && row.type === 'pilot_screener' && row.eligible)
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  const out = [];
  for (const row of eligible) {
    try {
      const result = await ensureAccountForScreener(row);
      out.push(toAdminRow(row, result, null));
    } catch (err) {
      out.push(toAdminRow(row, null, err.message || 'Could not create the login'));
    }
  }
  return out;
}

/** Study team recovery: the new code becomes the password. */
export async function replaceAccessCode(screenerId) {
  const row = await getItem(TABLES.SCREENERS, { id: screenerId });
  if (!row) {
    const err = new Error('Screener not found');
    err.status = 404;
    throw err;
  }
  const ensured = await ensureAccountForScreener(row);
  const userId = ensured.user?.id;
  if (!userId) {
    const err = new Error('Could not find the participant account');
    err.status = 404;
    throw err;
  }
  const code = makeAccessCode();
  const now = Date.now();
  await updateItem(TABLES.USERS, { id: userId }, {
    password_hash: hashPassword(code),
    access_code: code,
    password_changed_at: null,
    updated_at: now,
  });
  await updateItem(TABLES.SCREENERS, { id: screenerId }, {
    user_id: userId,
    access_code: code,
    password_changed: false,
    updated_at: now,
  });
  return {
    screenerId,
    email: ensured.user.email,
    accessCode: code,
    userId,
  };
}
