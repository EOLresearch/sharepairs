/**
 * Auth / access-control tests (MEMORY_DB).
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret REQUIRE_INVITE=true node --test scripts/auth-access.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_INVITE = 'true';
process.env.SIMPATICO_ENV = 'local';
process.env.ADMIN_EMAILS = '';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, getItem, scan, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';

function signStubToken(userId, { expOffsetSec = 24 * 60 * 60 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, iat: now, exp: now + expOffsetSec };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.STUB_AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `stub_${payloadB64}.${sig}`;
}

function unsignedJwt(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId })).toString('base64url');
  return `${header}.${payload}.`;
}

function hashPassword(password) {
  const computed = crypto
    .createHmac('sha256', process.env.STUB_AUTH_SECRET)
    .update(String(password))
    .digest('hex');
  return `hmac-sha256:${computed}`;
}

function lambdaEvent(method, path, { token, body } = {}) {
  return {
    rawPath: path,
    path,
    queryStringParameters: {},
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body != null ? JSON.stringify(body) : null,
    requestContext: {
      http: { method, path },
      stage: 'local',
    },
  };
}

function parse(res) {
  return JSON.parse(res.body || '{}');
}

async function seedUser(id, extras = {}) {
  const now = Date.now();
  const user = {
    id,
    email: extras.email || `${id}@local`,
    password_hash: extras.password_hash || hashPassword(extras.password || 'pw'),
    display_name: extras.display_name || id,
    is_admin: Boolean(extras.is_admin),
    email_verified: true,
    chat_disabled: false,
    contacts: [],
    created_at: now,
    updated_at: now,
    ...extras,
  };
  await putItem(TABLES.USERS, user);
  return user;
}

describe('auth access control', { concurrency: 1 }, () => {
  beforeEach(async () => {
    process.env.REQUIRE_INVITE = 'true';
    process.env.ADMIN_EMAILS = '';
    await resetMemoryDb();
  });

  test('registration without invite is rejected', async () => {
    const res = await route(lambdaEvent('POST', '/api/auth/register', {
      body: { email: 'p1@example.com', password: 'x', displayName: 'P1' },
    }));
    assert.equal(res.statusCode, 403);
    assert.equal(parse(res).code, 'auth/invalid-invite');
  });

  test('invalid invite is rejected', async () => {
    const res = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'p1@example.com',
        password: 'x',
        displayName: 'P1',
        inviteCode: 'AAAA-BBBB-CCCC',
      },
    }));
    assert.equal(res.statusCode, 403);
    assert.equal(parse(res).code, 'auth/invalid-invite');
  });

  test('admin can generate a single-use invite and registration consumes it', async () => {
    await seedUser('admin-1', { is_admin: true, email: 'ra@example.com' });
    const adminToken = signStubToken('admin-1');

    const created = await route(lambdaEvent('POST', '/api/admin/invites', {
      token: adminToken,
      body: {},
    }));
    assert.equal(created.statusCode, 201);
    const code = parse(created).invite?.code;
    assert.match(code, /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

    const listed = await route(lambdaEvent('GET', '/api/admin/invites', { token: adminToken }));
    assert.equal(listed.statusCode, 200);
    assert.equal(parse(listed).invites.filter((i) => !i.consumed).length, 1);

    const registered = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'p1@example.com',
        password: 'x',
        displayName: 'P1',
        inviteCode: code.toLowerCase(),
      },
    }));
    assert.equal(registered.statusCode, 201);
    const user = parse(registered).userData;
    assert.equal(user.admin, false);
    assert.ok(user.uid);

    const reuse = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'p2@example.com',
        password: 'x',
        displayName: 'P2',
        inviteCode: code,
      },
    }));
    assert.equal(reuse.statusCode, 403);
    assert.equal(parse(reuse).code, 'auth/invalid-invite');

    const users = await scan(TABLES.USERS);
    assert.equal(users.filter((u) => u.email === 'p2@example.com').length, 0);
    const inviteRow = users.find((u) => u.type === 'invite');
    assert.ok(inviteRow.consumed_at);
    assert.equal(inviteRow.consumed_by, user.uid);
  });

  test('participant cannot generate or list invites', async () => {
    await seedUser('user-1', { is_admin: false });
    const token = signStubToken('user-1');
    const created = await route(lambdaEvent('POST', '/api/admin/invites', { token, body: {} }));
    assert.equal(created.statusCode, 403);
    const listed = await route(lambdaEvent('GET', '/api/admin/invites', { token }));
    assert.equal(listed.statusCode, 403);
  });

  test('@med.cornell.edu registration is not auto-promoted to admin', async () => {
    await seedUser('admin-1', { is_admin: true });
    const created = await route(lambdaEvent('POST', '/api/admin/invites', {
      token: signStubToken('admin-1'),
      body: {},
    }));
    const code = parse(created).invite.code;
    const registered = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'tester@med.cornell.edu',
        password: 'x',
        displayName: 'Cornell',
        inviteCode: code,
      },
    }));
    assert.equal(registered.statusCode, 201);
    assert.equal(parse(registered).userData.admin, false);
    const row = await getItem(TABLES.USERS, { id: parse(registered).user.uid });
    assert.equal(row.is_admin, false);
  });

  test('ADMIN_EMAILS still promotes on login', async () => {
    process.env.ADMIN_EMAILS = 'ra@study.org';
    await seedUser('ra-1', { email: 'ra@study.org', password: 'secret', is_admin: false });
    const res = await route(lambdaEvent('POST', '/api/auth/login', {
      body: { email: 'ra@study.org', password: 'secret' },
    }));
    assert.equal(res.statusCode, 200);
    assert.equal(parse(res).userData.admin, true);
    const row = await getItem(TABLES.USERS, { id: 'ra-1' });
    assert.equal(row.is_admin, true);
  });

  test('unsigned JWT is rejected while STUB_AUTH=true', async () => {
    await seedUser('victim-1');
    const res = await route(lambdaEvent('GET', '/api/auth/me', {
      token: unsignedJwt('victim-1'),
    }));
    assert.equal(res.statusCode, 401);
  });

  test('expired stub token is rejected', async () => {
    await seedUser('user-1');
    const token = signStubToken('user-1', { expOffsetSec: -10 });
    const res = await route(lambdaEvent('GET', '/api/auth/me', { token }));
    assert.equal(res.statusCode, 401);
  });

  test('stub token without exp is rejected', async () => {
    await seedUser('user-1');
    const payloadB64 = Buffer.from(JSON.stringify({
      sub: 'user-1',
      iat: Math.floor(Date.now() / 1000),
    })).toString('base64url');
    const sig = crypto
      .createHmac('sha256', process.env.STUB_AUTH_SECRET)
      .update(payloadB64)
      .digest('base64url');
    const token = `stub_${payloadB64}.${sig}`;
    const res = await route(lambdaEvent('GET', '/api/auth/me', { token }));
    assert.equal(res.statusCode, 401);
  });

  test('invite rows are excluded from admin user list', async () => {
    await seedUser('admin-1', { is_admin: true });
    await route(lambdaEvent('POST', '/api/admin/invites', {
      token: signStubToken('admin-1'),
      body: {},
    }));
    const listed = await route(lambdaEvent('GET', '/api/admin/users', {
      token: signStubToken('admin-1'),
    }));
    assert.equal(listed.statusCode, 200);
    const users = parse(listed).users;
    assert.ok(users.every((u) => u && u.uid && !String(u.uid).startsWith('invite:')));
  });
});
