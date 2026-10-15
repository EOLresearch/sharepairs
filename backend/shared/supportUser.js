/**
 * Study Support account — special staff inbox user (no participant profile fields).
 * Fixed UID so chat/support threads stay stable across deploys.
 */
import crypto from 'crypto';
import { getItem, putItem, query, scan, deleteItem, TABLES } from './database.js';
import { config } from './config.js';
import { isLocalEnv } from './env.js';

const RETIRED_STUB_SECRETS = new Set([
  'sharepairs-dev-launch',
  'dev-secret-change-in-prod',
  'unset-set-via-wire-api',
]);

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

export const SUPPORT_EMAIL_DEFAULT = 'eolstudysupport@med.cornell.edu';
export const SUPPORT_PASSWORD_DEFAULT = 'password123';
export const SUPPORT_DISPLAY_NAME = 'Study Support';

function hashPassword(password) {
  const computed = crypto.createHmac('sha256', STUB_SECRET).update(String(password)).digest('hex');
  return `hmac-sha256:${computed}`;
}

export function getSupportEmail() {
  return String(process.env.SUPPORT_EMAIL || SUPPORT_EMAIL_DEFAULT).toLowerCase().trim();
}

export function getSupportPassword() {
  const fromEnv = process.env.SUPPORT_PASSWORD;
  if (fromEnv) {
    if (!isLocalEnv() && fromEnv === SUPPORT_PASSWORD_DEFAULT) {
      throw new Error('SUPPORT_PASSWORD cannot be the default password123 in study');
    }
    return fromEnv;
  }
  if (isLocalEnv()) return SUPPORT_PASSWORD_DEFAULT;
  throw new Error('SUPPORT_PASSWORD must be set');
}

async function findUserByEmail(email) {
  const norm = String(email || '').toLowerCase().trim();
  if (!norm) return null;
  try {
    const items = await query(TABLES.USERS, {
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': norm },
    });
    return items?.[0] || null;
  } catch {
    const all = await scan(TABLES.USERS);
    return all.find((u) => (u.email || '').toLowerCase() === norm) || null;
  }
}

/**
 * Ensure the Study Support user exists and can log in.
 * Minimal profile (no story / demographics). Always email_verified + admin.
 * Reclaims SUPPORT_EMAIL if a normal registration already used it.
 */
export async function ensureSupportUser() {
  const supportUid = config.supportUid;
  if (config.isLocal && supportUid === 'user-local-1') {
    const existing = await getItem(TABLES.USERS, { id: supportUid });
    if (existing) {
      if (!existing.is_support) {
        await putItem(TABLES.USERS, {
          ...existing,
          is_support: true,
          is_admin: true,
          updated_at: Date.now(),
        });
      }
      return { ...existing, is_support: true, is_admin: true };
    }
  }
  const email = getSupportEmail();
  const plain = getSupportPassword();
  const password_hash = hashPassword(plain);
  const now = Date.now();

  const byId = await getItem(TABLES.USERS, { id: supportUid });
  const byEmail = await findUserByEmail(email);

  // Another user registered with the support email — remove so login hits SUPPORT_UID
  if (byEmail && byEmail.id !== supportUid) {
    console.warn(
      `[support] Removing conflicting user ${byEmail.id} that held ${email}`
    );
    await deleteItem(TABLES.USERS, { id: byEmail.id });
  }

  const row = {
    ...(byId || {}),
    id: supportUid,
    email,
    password_hash,
    // drop plaintext password if present from old seeds
    password: undefined,
    display_name: SUPPORT_DISPLAY_NAME,
    photo_url:
      (byId && byId.photo_url) ||
      'https://api.dicebear.com/5.x/thumbs/svg?seed=Angel',
    is_admin: true,
    is_support: true,
    email_verified: true,
    preferred_language: 'en',
    timezone: 'UTC',
    contacts: Array.isArray(byId?.contacts) ? byId.contacts : [],
    chat_disabled: false,
    has_seen_match: true,
    study_consent: true,
    created_at: byId?.created_at || now,
    updated_at: now,
  };
  // DynamoDB Document client rejects undefined; strip it
  Object.keys(row).forEach((k) => {
    if (row[k] === undefined) delete row[k];
  });

  await putItem(TABLES.USERS, row);
  return row;
}
