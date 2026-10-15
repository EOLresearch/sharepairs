/**
 * Pair-level 8-week follow-up: first peer message clock, assignment, due-date gate.
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret node --test scripts/assessment-followup.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_INVITE = 'false';
process.env.SIMPATICO_ENV = 'local';
delete process.env.REDCAP_API_URL;
delete process.env.REDCAP_API_TOKEN;
delete process.env.REDCAP_MAPPING_CONFIRMED;

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, getItem, scan, updateItem, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';
import { config } from '../shared/config.js';
import {
  getInstrument,
  WEEK8_INSTRUMENT_IDS,
  WEEK8_TIME_POINT,
} from '../shared/assessments/instruments.js';
import { itemIsVisible } from '../shared/assessments/service.js';
import { dueAtForOffset } from '../shared/assessments/schedule.js';
import { INQ_SCALE_CONFIRMED, isInqScaleReady } from '../shared/assessments/inqScale.js';
import { PSSUQ_SCALE_CONFIRMED, isPssuqScaleReady, getPssuqScaleOptions } from '../shared/assessments/pssuqScale.js';
import { SUBSCALE_SCALE_CONFIRMED, isSubscaleScaleReady, getSubscaleScaleOptions } from '../shared/assessments/subscaleScale.js';

function signStubToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, iat: now, exp: now + 86400 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.STUB_AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `stub_${payloadB64}.${sig}`;
}

function lambdaEvent(method, path, { token, body, query } = {}) {
  return {
    rawPath: path,
    path,
    queryStringParameters: query || {},
    headers: token ? { Authorization: 'Bearer ' + token } : {},
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

function convoId(a, b) {
  return [a, b].map(String).sort().join('+');
}

function answersFor(instrumentId) {
  const def = getInstrument(instrumentId);
  const out = {};
  for (const item of def.items) {
    if (item.type === 'info') continue;
    if (!itemIsVisible(item, out)) continue;
    if (item.optional) continue;
    if (item.type === 'textarea' || item.type === 'text') {
      out[item.id] = 'test response';
      continue;
    }
    const options = Array.isArray(item.options) ? item.options : [];
    out[item.id] = options[0]?.value || '1';
  }
  return out;
}

async function seedAdmin() {
  const now = Date.now();
  await putItem(TABLES.USERS, {
    id: 'admin-1',
    email: 'ra@local',
    display_name: 'RA',
    is_admin: true,
    email_verified: true,
    created_at: now,
    updated_at: now,
  });
  return signStubToken('admin-1');
}

async function registerUser(email, displayName) {
  const res = await route(lambdaEvent('POST', '/api/auth/register', {
    body: { email, password: 'Secret1!', displayName },
  }));
  assert.equal(res.statusCode, 201, parse(res).error);
  const data = parse(res);
  return { uid: data.user.uid, token: data.token };
}

async function matchedPeerChat() {
  const adminToken = await seedAdmin();
  const a = await registerUser('p1@example.com', 'Pat');
  const b = await registerUser('p2@example.com', 'Sam');
  const matched = await route(lambdaEvent('POST', '/api/admin/matches', {
    token: adminToken,
    body: { uid: a.uid, matchUid: b.uid },
  }));
  assert.equal(matched.statusCode, 200, parse(matched).error);
  const created = await route(lambdaEvent('POST', '/api/conversations', {
    token: a.token,
    body: { initiatorUid: a.uid, otherUid: b.uid },
  }));
  assert.equal(created.statusCode, 200, parse(created).error);
  const consented = await route(lambdaEvent('POST', '/api/consent/request', {
    token: b.token,
    body: { matchId: a.uid },
  }));
  assert.equal(consented.statusCode, 200, parse(consented).error);
  return { adminToken, a, b, cid: convoId(a.uid, b.uid) };
}

function week8Rows(uid) {
  return scan(TABLES.ASSESSMENTS).then((all) => all.filter(
    (r) => r.user_id === uid && r.time_point === WEEK8_TIME_POINT.id
  ));
}

describe('8-week follow-up', { concurrency: 1 }, () => {
  beforeEach(async () => {
    process.env.REQUIRE_INVITE = 'false';
    await resetMemoryDb();
  });

  test('INQ uses 1-7; PSSUQ and subscales use confirmed 5-point scales', () => {
    assert.equal(INQ_SCALE_CONFIRMED, true);
    assert.equal(isInqScaleReady(), true);
    assert.equal(getInstrument('inq15').scalePending, false);
    assert.equal(getInstrument('inq15').items.length, 15);
    assert.deepEqual(getInstrument('inq15').items[0].options.map((o) => o.value), ['1', '2', '3', '4', '5', '6', '7']);

    assert.equal(PSSUQ_SCALE_CONFIRMED, true);
    assert.equal(isPssuqScaleReady(), true);
    assert.equal(getInstrument('pssuq').scalePending, false);
    const pssuq = getPssuqScaleOptions();
    assert.deepEqual(pssuq.map((o) => o.value), ['1', '2', '3', '4', '5']);
    assert.equal(pssuq[0].label, 'Strongly Disagree');
    assert.equal(pssuq[2].label, 'Neither agree nor disagree');
    assert.equal(pssuq[4].label, 'Strongly Agree');

    assert.equal(SUBSCALE_SCALE_CONFIRMED, true);
    assert.equal(isSubscaleScaleReady(), true);
    assert.equal(getInstrument('simpatico_subscales').scalePending, false);
    assert.deepEqual(getSubscaleScaleOptions().map((o) => o.value), ['1', '2', '3', '4', '5']);

    assert.equal(getInstrument('pg13r').contentPending, false);
    assert.ok(getInstrument('pg13r').items.length > 0);
    assert.equal(getInstrument('cssrs'), null);
    assert.equal(getInstrument('c-ssrs'), null);
    assert.equal(WEEK8_INSTRUMENT_IDS.includes('inq15'), true);
    assert.equal(WEEK8_INSTRUMENT_IDS.includes('simpatico'), false);
    assert.equal(WEEK8_INSTRUMENT_IDS.includes('cssrs'), false);
  });

  test('match, request, and acceptance do not start the clock or assign week8', async () => {
    const { a, b, cid } = await matchedPeerChat();
    const convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
    assert.equal(convo.intervention_start_at, undefined);
    assert.equal((await week8Rows(a.uid)).length, 0);
    assert.equal((await week8Rows(b.uid)).length, 0);
  });

  test('first real peer message starts a write-once pair clock and assigns week8 to both', async () => {
    const { a, b, cid } = await matchedPeerChat();
    const before = Date.now();
    const send = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'Hi Sam, this is Pat.' },
    }));
    const after = Date.now();
    assert.equal(send.statusCode, 200, parse(send).error);

    const convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
    const startAt = Number(convo.intervention_start_at);
    assert.ok(startAt >= before && startAt <= after);
    const expectedDue = dueAtForOffset(startAt, WEEK8_TIME_POINT.offsetDays);

    const aRows = await week8Rows(a.uid);
    const bRows = await week8Rows(b.uid);
    assert.deepEqual(aRows.map((r) => r.instrument_id).sort(), [...WEEK8_INSTRUMENT_IDS].sort());
    assert.deepEqual(bRows.map((r) => r.instrument_id).sort(), [...WEEK8_INSTRUMENT_IDS].sort());
    assert.ok(aRows.every((r) => r.due_at === expectedDue));
    assert.ok(bRows.every((r) => r.due_at === expectedDue));
    assert.equal(aRows.some((r) => r.instrument_id === 'simpatico'), false);
    assert.equal(aRows.some((r) => /cssrs/i.test(r.instrument_id)), false);

    const second = await route(lambdaEvent('POST', '/api/messages/send', {
      token: b.token,
      body: { conversationId: cid, body: 'Hi Pat.' },
    }));
    assert.equal(second.statusCode, 200, parse(second).error);
    const convo2 = await getItem(TABLES.CONVERSATIONS, { id: cid });
    assert.equal(Number(convo2.intervention_start_at), startAt);
    assert.equal((await week8Rows(a.uid)).length, WEEK8_INSTRUMENT_IDS.length);
    assert.equal((await week8Rows(b.uid)).length, WEEK8_INSTRUMENT_IDS.length);
    const aDue = (await week8Rows(a.uid)).map((r) => r.due_at);
    assert.ok(aDue.every((d) => d === expectedDue));
  });

  test('study support messages do not start the clock', async () => {
    const { a } = await matchedPeerChat();
    const supportUid = config.supportUid;
    await putItem(TABLES.USERS, {
      id: supportUid,
      email: 'support@local',
      display_name: 'Study Support',
      is_support: true,
      email_verified: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    const supportCid = convoId(a.uid, supportUid);
    await putItem(TABLES.CONVERSATIONS, {
      id: supportCid,
      users: [a.uid, supportUid].sort(),
      requester: a.uid,
      recipient: supportUid,
      type: 'support',
      consent_by: [a.uid, supportUid],
      mutual_consent: true,
      is_closed: false,
      moderation_status: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    const send = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: supportCid, body: 'I need help with login.' },
    }));
    assert.equal(send.statusCode, 200, parse(send).error);
    const supportConvo = await getItem(TABLES.CONVERSATIONS, { id: supportCid });
    assert.equal(supportConvo.intervention_start_at, undefined);
    assert.equal((await week8Rows(a.uid)).length, 0);
  });

  test('participant cannot submit week8 before dueAt', async () => {
    const { a, b, cid } = await matchedPeerChat();
    const send = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'Starting the conversation.' },
    }));
    assert.equal(send.statusCode, 200, parse(send).error);

    const lsnsId = `asg:${a.uid}:lsns6:week8`;
    const early = await route(lambdaEvent('POST', `/api/assessments/${lsnsId}/submit`, {
      token: a.token,
      body: { responses: answersFor('lsns6') },
    }));
    assert.equal(early.statusCode, 400);
    assert.match(parse(early).error || parse(early).message || '', /not available/i);
    const still = await getItem(TABLES.ASSESSMENTS, { id: lsnsId });
    assert.notEqual(still.status, 'complete');

    const inqId = `asg:${a.uid}:inq15:week8`;
    const inqEarly = await route(lambdaEvent('POST', `/api/assessments/${inqId}/submit`, {
      token: a.token,
      body: { responses: { inq_1: '1' } },
    }));
    assert.equal(inqEarly.statusCode, 400);

    const pssuqId = `asg:${a.uid}:pssuq:week8`;
    const pssuqEarly = await route(lambdaEvent('POST', `/api/assessments/${pssuqId}/submit`, {
      token: a.token,
      body: { responses: { pssuq_1: '1' } },
    }));
    assert.equal(pssuqEarly.statusCode, 400);
    assert.match(parse(pssuqEarly).error || parse(pssuqEarly).message || '', /not available/i);

    const cssrs = await route(lambdaEvent('POST', `/api/assessments/asg:${a.uid}:cssrs:week8/submit`, {
      token: a.token,
      body: { responses: {} },
    }));
    assert.equal(cssrs.statusCode, 404);

    const convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
    await updateItem(TABLES.ASSESSMENTS, { id: lsnsId }, {
      due_at: Number(convo.intervention_start_at) - 1,
      updated_at: Date.now(),
    });
    const dueNow = await route(lambdaEvent('POST', `/api/assessments/${lsnsId}/submit`, {
      token: a.token,
      body: { responses: answersFor('lsns6') },
    }));
    assert.equal(dueNow.statusCode, 200, parse(dueNow).error);
    assert.equal(parse(dueNow).assignment.status, 'complete');
    assert.equal(parse(dueNow).assignment.instrumentId, 'lsns6');
    assert.equal(parse(dueNow).assignment.timePoint, 'week8');
  });

  test('termination after first message keeps assignments; before first message creates none', async () => {
    const { adminToken, a, b, cid } = await matchedPeerChat();
    const send = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'Hello from Pat.' },
    }));
    assert.equal(send.statusCode, 200, parse(send).error);
    const startAt = Number((await getItem(TABLES.CONVERSATIONS, { id: cid })).intervention_start_at);
    const dueBefore = (await week8Rows(a.uid))[0].due_at;

    const terminate = await route(lambdaEvent('POST', '/api/admin/conversations/moderation', {
      token: adminToken,
      body: { conversationId: cid, status: 'terminated' },
    }));
    assert.equal(terminate.statusCode, 200, parse(terminate).error);
    const convo = await getItem(TABLES.CONVERSATIONS, { id: cid });
    assert.equal(Number(convo.intervention_start_at), startAt);
    assert.equal((await week8Rows(a.uid)).length, WEEK8_INSTRUMENT_IDS.length);
    assert.equal((await week8Rows(b.uid)).length, WEEK8_INSTRUMENT_IDS.length);
    assert.equal((await week8Rows(a.uid))[0].due_at, dueBefore);

    const c = await registerUser('p3@example.com', 'Alex');
    const d = await registerUser('p4@example.com', 'Riley');
    await route(lambdaEvent('POST', '/api/admin/matches', {
      token: adminToken,
      body: { uid: c.uid, matchUid: d.uid },
    }));
    const cid2 = convoId(c.uid, d.uid);
    await route(lambdaEvent('POST', '/api/conversations', {
      token: c.token,
      body: { initiatorUid: c.uid, otherUid: d.uid },
    }));
    await route(lambdaEvent('POST', '/api/consent/request', {
      token: d.token,
      body: { matchId: c.uid },
    }));
    const terminateEarly = await route(lambdaEvent('POST', '/api/admin/conversations/moderation', {
      token: adminToken,
      body: { conversationId: cid2, status: 'terminated' },
    }));
    assert.equal(terminateEarly.statusCode, 200, parse(terminateEarly).error);
    const blocked = await route(lambdaEvent('POST', '/api/messages/send', {
      token: c.token,
      body: { conversationId: cid2, body: 'too late' },
    }));
    assert.equal(blocked.statusCode, 403);
    const convo2 = await getItem(TABLES.CONVERSATIONS, { id: cid2 });
    assert.equal(convo2.intervention_start_at, undefined);
    assert.equal((await week8Rows(c.uid)).length, 0);
    assert.equal((await week8Rows(d.uid)).length, 0);
  });

  test('follow-up assigns week8 only', async () => {
    const { a, cid } = await matchedPeerChat();
    await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'Hi.' },
    }));
    const all = (await scan(TABLES.ASSESSMENTS)).filter((r) => r.user_id === a.uid);
    assert.equal(all.some((r) => r.time_point === 'baseline'), false);
    assert.ok(all.some((r) => r.time_point === 'week8'));
    assert.equal(all.some((r) => r.time_point === 'week2' || r.time_point === 'week4' || r.time_point === 'week12'), false);
  });
});
