/**
 * Single-use registration invites.
 *
 * Stored as rows in the existing users table (id `invite:{code}`, type `invite`)
 * so Oct 1 does not need a new DynamoDB table. Rows hold no participant PHI.
 * Eligibility / consent stay upstream; this only gates registration.
 */
import crypto from 'crypto';
import { getItem, putItem, updateItem, scan, TABLES } from './database.js';
import { isLocalEnv } from './env.js';

const INVITE_PREFIX = 'invite:';

export function requireInviteCode() {
  const raw = String(process.env.REQUIRE_INVITE ?? '').toLowerCase().trim();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return !isLocalEnv();
}

export function isInviteRecord(row) {
  if (!row) return false;
  return row.type === 'invite' || String(row.id || '').startsWith(INVITE_PREFIX);
}

export function normalizeInviteCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatInviteCode(compact) {
  const c = normalizeInviteCode(compact);
  if (c.length !== 12) return c;
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

function inviteId(compact) {
  return `${INVITE_PREFIX}${normalizeInviteCode(compact)}`;
}

function invalidInviteError() {
  const err = new Error('Invite code is invalid or already used.');
  err.code = 'auth/invalid-invite';
  err.status = 403;
  return err;
}

export async function createInvite({ createdBy } = {}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const compact = crypto.randomBytes(6).toString('hex').toUpperCase();
    const id = inviteId(compact);
    const existing = await getItem(TABLES.USERS, { id });
    if (existing) continue;
    const now = Date.now();
    const code = formatInviteCode(compact);
    const row = {
      id,
      type: 'invite',
      code,
      created_at: now,
      updated_at: now,
      created_by: createdBy || null,
    };
    await putItem(TABLES.USERS, row);
    return { code, createdAt: now, createdBy: createdBy || null };
  }
  throw new Error('Could not generate a unique invite code');
}

export async function listInvites() {
  const all = await scan(TABLES.USERS);
  return (all || [])
    .filter(isInviteRecord)
    .map((row) => ({
      code: row.code || formatInviteCode(String(row.id || '').slice(INVITE_PREFIX.length)),
      createdAt: row.created_at || null,
      createdBy: row.created_by || null,
      consumedAt: row.consumed_at || null,
      consumed: row.consumed_at != null,
    }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

/**
 * Atomically consume a unused invite. Throws auth/invalid-invite otherwise.
 */
export async function consumeInvite(code, userId) {
  const compact = normalizeInviteCode(code);
  if (compact.length !== 12) throw invalidInviteError();
  const id = inviteId(compact);
  const now = Date.now();
  try {
    await updateItem(
      TABLES.USERS,
      { id },
      {
        consumed_at: now,
        consumed_by: userId || null,
        updated_at: now,
      },
      {
        condition: (row) => Boolean(row && row.type === 'invite' && row.consumed_at == null),
        conditionExpression:
          'attribute_exists(id) AND #type = :invite AND attribute_not_exists(consumed_at)',
        extraNames: { '#type': 'type' },
        extraValues: { ':invite': 'invite' },
      }
    );
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') throw invalidInviteError();
    throw err;
  }
}
