/**
 * Eligible screener creates a Share Pairs login.
 * Email is the username. The access code is the password until it is changed.
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret SIMPATICO_ENV=study node --test scripts/screener-account.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.SIMPATICO_ENV = 'study';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_INVITE = 'true';
delete process.env.SES_FROM_EMAIL;

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, scan, TABLES } from '../shared/database.js';
import { stubLogin } from '../shared/stubAuth.js';
import { ensureAccountForScreener, listEligibleScreeners, replaceAccessCode } from '../shared/screeners.js';
import { route } from '../functions/api/router.js';
import crypto from 'crypto';

function signStubToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, iat: now, exp: now + 3600 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.STUB_AUTH_SECRET).update(payloadB64).digest('base64url');
  return `stub_${payloadB64}.${sig}`;
}

function eligibleRow(overrides = {}) {
  return {
    id: 'screener-1',
    type: 'pilot_screener',
    user_id: null,
    eligible: true,
    email: 'casey@example.com',
    access_code: 'H7K2M9QA',
    sharepairs_profile: {
      email: 'casey@example.com',
      kinship: 'Parent',
      residence: 'New York',
      country: 'United States',
    },
    result: { kinship: 'Parent' },
    created_at: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  resetMemoryDb();
});

test('eligible screener creates a login and the access code signs them in', async () => {
  await putItem(TABLES.SCREENERS, eligibleRow());
  const created = await ensureAccountForScreener(eligibleRow());
  assert.equal(created.created, true);
  assert.equal(created.user.email, 'casey@example.com');
  assert.equal(created.user.kinship, 'Parent');
  assert.equal(created.user.residence, 'New York');
  assert.equal(created.accessCode, 'H7K2M9QA');

  const session = await stubLogin('Casey@example.com', 'H7K2M9QA');
  assert.ok(session?.token);
  assert.equal(session.userData.usingAccessCode, true);

  const again = await ensureAccountForScreener(eligibleRow());
  assert.equal(again.created, false);
  const users = (await scan(TABLES.USERS)).filter((row) => row.email === 'casey@example.com');
  assert.equal(users.length, 1);
});

test('ineligible screeners are not turned into accounts', async () => {
  await putItem(TABLES.SCREENERS, eligibleRow({
    id: 'screener-no',
    eligible: false,
    email: undefined,
    access_code: undefined,
  }));
  const rows = await listEligibleScreeners();
  assert.equal(rows.length, 0);
  assert.equal((await scan(TABLES.USERS)).length, 0);
});

test('changing the password retires the access code', async () => {
  await putItem(TABLES.SCREENERS, eligibleRow());
  const created = await ensureAccountForScreener(eligibleRow());
  const event = {
    rawPath: '/api/auth/change-password',
    path: '/api/auth/change-password',
    headers: { Authorization: `Bearer ${signStubToken(created.user.id)}` },
    body: JSON.stringify({ currentPassword: 'H7K2M9QA', newPassword: 'Newpass1!' }),
    requestContext: { http: { method: 'POST', path: '/api/auth/change-password' } },
  };
  const res = await route(event);
  assert.equal(res.statusCode, 200);

  assert.equal(await stubLogin('casey@example.com', 'H7K2M9QA'), null);
  const next = await stubLogin('casey@example.com', 'Newpass1!');
  assert.ok(next?.token);
  assert.equal(next.userData.usingAccessCode, false);

  const listed = await listEligibleScreeners();
  assert.equal(listed[0].passwordChanged, true);
  assert.equal(listed[0].accessCode, null);
});

test('study team can issue a new access code after the password changed', async () => {
  await putItem(TABLES.SCREENERS, eligibleRow());
  const created = await ensureAccountForScreener(eligibleRow());
  const event = {
    rawPath: '/api/auth/change-password',
    path: '/api/auth/change-password',
    headers: { Authorization: `Bearer ${signStubToken(created.user.id)}` },
    body: JSON.stringify({ currentPassword: 'H7K2M9QA', newPassword: 'Newpass1!' }),
    requestContext: { http: { method: 'POST', path: '/api/auth/change-password' } },
  };
  assert.equal((await route(event)).statusCode, 200);

  const issued = await replaceAccessCode('screener-1');
  assert.notEqual(issued.accessCode, 'H7K2M9QA');
  assert.equal(await stubLogin('casey@example.com', 'Newpass1!'), null);
  const session = await stubLogin('casey@example.com', issued.accessCode);
  assert.ok(session?.token);
  assert.equal(session.userData.usingAccessCode, true);
});
