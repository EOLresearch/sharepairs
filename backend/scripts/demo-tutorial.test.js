/**
 * Local demo tutorial staging. Not used on the study site.
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret node --test scripts/demo-tutorial.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.SIMPATICO_ENV = 'local';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
delete process.env.DEMO_TUTORIAL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { getItem, updateItem, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';
import { WEEK8_INSTRUMENT_IDS } from '../shared/assessments/instruments.js';
import { DEMO_PARTICIPANT_ID } from '../shared/demoTutorial.js';

function lambdaEvent(method, path, { token, body } = {}) {
  return {
    rawPath: path,
    path,
    queryStringParameters: {},
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body != null ? JSON.stringify(body) : null,
    requestContext: { http: { method, path }, stage: 'local' },
  };
}

function parse(res) {
  return JSON.parse(res.body || '{}');
}

async function stage(state) {
  return route(lambdaEvent('POST', '/api/dev/tutorial', { body: { state } }));
}

async function loginDemo() {
  const res = await route(lambdaEvent('POST', '/api/auth/login', {
    body: { email: 'demo', password: 'demo' },
  }));
  assert.equal(res.statusCode, 200, parse(res).error);
  return parse(res);
}

describe('demo tutorial mode', { concurrency: 1 }, () => {
  beforeEach(async () => {
    delete process.env.DEMO_TUTORIAL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    process.env.SIMPATICO_ENV = 'local';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
    await resetMemoryDb();
  });

  afterEach(() => {
    delete process.env.DEMO_TUTORIAL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    process.env.SIMPATICO_ENV = 'local';
  });

  test('tutorial routes stay hidden unless the local flag is on', async () => {
    const hidden = await stage('baseline');
    assert.equal(hidden.statusCode, 404);

    process.env.DEMO_TUTORIAL = 'true';
    process.env.SIMPATICO_ENV = 'study';
    const study = await stage('baseline');
    assert.equal(study.statusCode, 404);

    process.env.SIMPATICO_ENV = 'local';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'sharepairs-dev-api';
    const lambda = await stage('baseline');
    assert.equal(lambda.statusCode, 404);
  });

  test('demo participant is not an admin and can skip email verification', async () => {
    process.env.DEMO_TUTORIAL = 'true';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    const staged = await stage('baseline');
    assert.equal(staged.statusCode, 200);
    await updateItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }, { email_verified: false });

    const session = await loginDemo();
    assert.equal(session.user.emailVerified, true);
    assert.equal(session.userData.admin, false);
    assert.equal(session.userData.isSupport, false);
    const row = await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
    assert.equal(row.is_admin, false);
    assert.equal(row.email_verified, true);
  });

  test('baseline staging assigns nothing, and follow-up includes INQ once staged', async () => {
    process.env.DEMO_TUTORIAL = 'true';
    assert.equal(WEEK8_INSTRUMENT_IDS.includes('inq15'), true);

    const baseline = await stage('baseline');
    assert.equal(baseline.statusCode, 200);
    const session = await loginDemo();
    const mine = await route(lambdaEvent('GET', '/api/assessments', { token: session.token }));
    const rows = parse(mine).assignments;
    assert.deepEqual(rows, []);
    assert.equal(session.userData.simpaticoMatch, null);

    const follow = await stage('followup');
    assert.equal(follow.statusCode, 200);
    const again = await loginDemo();
    const followRows = parse(await route(lambdaEvent('GET', '/api/assessments', { token: again.token }))).assignments;
    const inq = followRows.find((row) => row.instrumentId === 'inq15' && row.timePoint === 'week8');
    assert.ok(inq);
    assert.equal(inq.status, 'due');

    const convos = parse(await route(lambdaEvent('GET', '/api/conversations', { token: again.token }))).conversations;
    assert.equal(convos.length, 1);
    assert.equal(convos[0].mutualConsent, true);
    assert.match(convos[0].lastMsgPreview, /damn/);
    assert.equal(again.userData.simpaticoMatch.displayName, 'Jordan Hale');
    assert.equal(again.userData.admin, false);
  });

  test('waiting stages do not assign baseline or a match', async () => {
    process.env.DEMO_TUTORIAL = 'true';
    const staged = await stage('one-left');
    assert.equal(staged.statusCode, 200);
    const session = await loginDemo();
    assert.equal(session.userData.admin, false);
    assert.equal(session.userData.simpaticoMatch, null);

    const rows = parse(await route(lambdaEvent('GET', '/api/assessments', { token: session.token }))).assignments;
    assert.deepEqual(rows, []);
    const missing = await route(lambdaEvent('POST', '/api/assessments/asg:user-demo-participant:lsns6:baseline/submit', {
      token: session.token,
      body: { responses: {} },
    }));
    assert.equal(missing.statusCode, 404);
  });

  test('recording steps stay on the participant account and do not email', async () => {
    process.env.DEMO_TUTORIAL = 'true';
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    const cleared = await stage('account');
    assert.equal(cleared.statusCode, 200);
    const missing = await route(lambdaEvent('POST', '/api/auth/login', {
      body: { email: 'demo', password: 'demo' },
    }));
    assert.notEqual(missing.statusCode, 200);

    const registered = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'demo',
        password: 'demo',
        displayName: 'Casey Morgan',
        residence: 'New York',
        lossExp: 'Fictional tutorial story.',
        admin: true,
      },
    }));
    assert.ok(registered.statusCode === 200 || registered.statusCode === 201, parse(registered).error);
    const session = parse(registered);
    assert.equal(session.user.uid, DEMO_PARTICIPANT_ID);
    assert.equal(session.user.emailVerified, true);
    assert.equal(session.needsConfirmation, false);
    assert.equal(session.userData.admin, false);

    const seeded = await stage('seed-answers');
    assert.equal(seeded.statusCode, 200);
    const mine = parse(await route(lambdaEvent('GET', '/api/assessments', { token: session.token }))).assignments;
    assert.deepEqual(mine, []);
    const waiting = await loginDemo();
    assert.equal(waiting.userData.simpaticoMatch, null);

    const matched = await stage('matched');
    assert.equal(matched.statusCode, 200);
    const matchedSession = await loginDemo();
    assert.equal(matchedSession.userData.simpaticoMatch.displayName, 'Jordan Hale');
    assert.equal(matchedSession.userData.admin, false);
    assert.equal(matchedSession.userData.matchNoticeSeen, false);
    assert.equal(matchedSession.userData.displayName, 'Casey Morgan');

    const tooSoon = await stage('accept');
    assert.equal(tooSoon.statusCode, 400);

    const requested = await route(lambdaEvent('POST', '/api/consent/request', {
      token: matchedSession.token,
      body: { matchId: 'user-demo-partner' },
    }));
    assert.equal(requested.statusCode, 200, parse(requested).error);
    assert.equal(parse(requested).mutualConsent, false);

    const accepted = await stage('accept');
    assert.equal(accepted.statusCode, 200);
    const convos = parse(await route(lambdaEvent('GET', '/api/conversations', {
      token: matchedSession.token,
    }))).conversations;
    const peer = convos.find((row) => row.mutualConsent && row.users.includes('user-demo-partner'));
    assert.ok(peer);

    const reply = await stage('reply');
    assert.equal(reply.statusCode, 200);
    const listed = parse(await route({
      ...lambdaEvent('GET', '/api/messages', { token: matchedSession.token }),
      queryStringParameters: { conversationId: peer.docID || peer.cid },
      rawPath: '/api/messages',
      path: '/api/messages',
    })).messages;
    assert.ok(listed.some((row) => /damn/.test(row.body || '')));

    const support = await stage('support');
    assert.equal(support.statusCode, 200);
    const afterSupport = parse(await route(lambdaEvent('GET', '/api/conversations', {
      token: matchedSession.token,
    }))).conversations;
    assert.ok(afterSupport.some((row) => (row.users || []).includes('user-local-1')));

    const follow = await stage('followup');
    assert.equal(follow.statusCode, 200);
    const followRows = parse(await route(lambdaEvent('GET', '/api/assessments', {
      token: matchedSession.token,
    }))).assignments;
    const inq = followRows.find((row) => row.instrumentId === 'inq15' && row.timePoint === 'week8');
    assert.ok(inq);
    assert.equal(inq.status, 'due');
    const still = await loginDemo();
    assert.equal(still.userData.admin, false);
    assert.equal(still.userData.displayName, 'Casey Morgan');
  });
});
