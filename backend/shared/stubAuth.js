/**
 * Stub auth for local/dev: validate email+password against users table,
 * issue a simple JWT-like token (or opaque token) so GET /api/auth/me can resolve user.
 * For production, replace with Cognito; keep this behind STUB_AUTH=true only.
 */
import { query, getItem } from './database.js';
import { TABLES } from './database.js';
import crypto from 'crypto';

const STUB_SECRET = process.env.STUB_AUTH_SECRET || 'dev-secret-change-in-prod';
const TOKEN_PREFIX = 'stub_';

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

/**
 * Verify password (stub: compare with stored password_hash or plaintext password in dev).
 */
function checkPassword(user, password) {
  if (!user || !password) return false;
  const hash = user.password_hash;
  if (hash) {
    const [algo, ...rest] = hash.split(':');
    const computed = crypto.createHmac('sha256', STUB_SECRET).update(password).digest('hex');
    return rest.join(':') === computed;
  }
  return user.password === password;
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
    admin: Boolean(row.is_admin || row.admin),
    simpaticoMatch: row.simpatico_match || row.simpaticoMatch || null,
    contacts: row.contacts || [],
    chatDisabled: Boolean(row.chat_disabled || row.chatDisabled),
    hasSeenMatch: Boolean(row.has_seen_match || row.hasSeenMatch),
    ...row,
  };
}
