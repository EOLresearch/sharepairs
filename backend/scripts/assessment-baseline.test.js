/**
 * Retired baseline workflow, retained historical rows, and INQ 1–7 scale.
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret node --test scripts/assessment-baseline.test.js
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
import { putItem, getItem, scan, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';
import { getInstrument, matchingRequiredInstrumentIds, BASELINE_INSTRUMENT_IDS, BASELINE_TIME_POINT, WEEK8_INSTRUMENT_IDS } from '../shared/assessments/instruments.js';
import { itemIsVisible, assignBaselineForUsers, assignFollowUpForUsers, processAssessmentReminders } from '../shared/assessments/service.js';
import { monthsSinceLoss } from '../shared/assessments/prefill.js';
import { INQ_SCALE_CONFIRMED, INQ_SCALE_OPTIONS, INQ_REVERSE_ITEM_NUMBERS, inqScoredValue, isInqScaleReady } from '../shared/assessments/inqScale.js';

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

function answersFor(instrumentId, seed = {}) {
  const def = getInstrument(instrumentId);
  const out = { ...seed };
  for (const item of def.items) {
    if (item.type === 'info') continue;
    if (!itemIsVisible(item, out)) continue;
    if (item.optional) continue;
    if (out[item.id] != null && String(out[item.id]).trim() !== '') continue;
    if (item.type === 'textarea' || item.type === 'text') {
      out[item.id] = 'test response';
      continue;
    }
    const options = Array.isArray(item.options) ? item.options : [];
    out[item.id] = options[0]?.value || '1';
  }
  return out;
}

describe('baseline assessments', { concurrency: 1 }, () => {
  beforeEach(async () => {
    process.env.REQUIRE_INVITE = 'false';
    await resetMemoryDb();
  });

  test('INQ uses a 1-7 scale and 15 numbered items, and is intake rather than baseline', () => {
    assert.equal(INQ_SCALE_CONFIRMED, true);
    assert.equal(isInqScaleReady(), true);
    assert.deepEqual(INQ_SCALE_OPTIONS.map((o) => o.value), ['1', '2', '3', '4', '5', '6', '7']);
    assert.equal(INQ_SCALE_OPTIONS[0].label, '1 — Not at all true for me');
    assert.equal(INQ_SCALE_OPTIONS[3].label, '4 — Somewhat true for me');
    assert.equal(INQ_SCALE_OPTIONS[6].label, '7 — Very true for me');
    const inq = getInstrument('inq15');
    assert.equal(inq.scalePending, false);
    assert.equal(inq.items.length, 15);
    assert.deepEqual(
      inq.items.map((item) => item.text.slice(0, item.text.indexOf('.'))),
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
    );
    assert.equal(inq.items.filter((item) => item.text.startsWith('4.')).length, 1);
    assert.deepEqual(inq.items[0].options.map((o) => o.value), ['1', '2', '3', '4', '5', '6', '7']);
    assert.equal(BASELINE_INSTRUMENT_IDS.includes('inq15'), false);
    assert.equal(WEEK8_INSTRUMENT_IDS.includes('inq15'), true);
    assert.deepEqual(matchingRequiredInstrumentIds(), []);
    assert.ok(BASELINE_INSTRUMENT_IDS.includes('loss_characteristics'));
    assert.deepEqual(
      inq.items.filter((item) => item.reverseCoded).map((item) => item.id),
      ['inq_7', 'inq_8', 'inq_10', 'inq_13', 'inq_14', 'inq_15']
    );
    assert.deepEqual(INQ_REVERSE_ITEM_NUMBERS, [7, 8, 10, 13, 14, 15]);
    assert.equal(inqScoredValue(1, '2'), 2);
    assert.equal(inqScoredValue(7, '1'), 7);
    assert.equal(inqScoredValue(7, '7'), 1);
    assert.equal(inqScoredValue(14, '3'), 5);
    const intakeCssrs = getInstrument('cssrs_intake');
    assert.deepEqual(intakeCssrs.items.map((item) => item.id), ['cssrs_s1']);
    assert.equal(
      intakeCssrs.items[0].text,
      '1) Have you wished you were dead or wished you could go to sleep and not wake up?'
    );
    assert.equal(getInstrument('cssrs_screening').items.some((item) => item.id === 'cssrs_s2'), true);
  });

  test('registration does not assign baseline and email is only a screener lookup key', async () => {
    const res = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'Pat.One@Example.com',
        password: 'Secret1!',
        displayName: 'Pat',
        kinship: 'Spouse',
        cause: 'Natural',
        hobbies: 'gardening',
        consent: true,
      },
    }));
    assert.equal(res.statusCode, 201);
    const body = parse(res);
    const uid = body.user.uid;
    assert.equal(body.screeningLink.email, 'pat.one@example.com');
    assert.equal(body.screeningLink.source, 'account_email');
    assert.equal(body.screeningLink.eligibilityConfirmed, false);
    assert.equal(body.screeningLink.screenerConsentConfirmed, false);
    assert.equal(body.user.emailVerified, true);

    const user = await getItem(TABLES.USERS, { id: uid });
    assert.equal(user.email, 'pat.one@example.com');
    assert.equal(user.study_consent, true);
    assert.equal(user.eligibility, undefined);
    assert.equal(user.screener_id, undefined);
    assert.equal(user.screening_email, undefined);

    const rows = (await scan(TABLES.ASSESSMENTS)).filter((r) => r.user_id === uid);
    assert.equal(rows.some((r) => r.time_point === 'baseline'), false);
    assert.equal(rows.some((r) => r.instrument_id === 'loss_characteristics'), false);

    const mine = await route(lambdaEvent('GET', '/api/assessments', { token: body.token }));
    assert.deepEqual(parse(mine).assignments, []);
  });

  test('historical baseline rows stay stored and leave the participant workflow', async () => {
    const adminToken = await seedAdmin();
    const registered = parse(await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'hist@example.com',
        password: 'Secret1!',
        kinship: 'Spouse',
        cause: 'Natural',
        hobbies: 'gardening',
      },
    })));
    const uid = registered.user.uid;
    const token = registered.token;
    await assignBaselineForUsers([uid], { anchorMs: Date.now() - 60 * 60 * 1000 });
    const id = `asg:${uid}:loss_characteristics:baseline`;
    const stored = await getItem(TABLES.ASSESSMENTS, { id });
    assert.equal(stored.time_point, 'baseline');
    assert.equal(stored.responses.lc_kinship, 'Spouse');
    assert.notEqual(stored.status, 'complete');

    const mine = parse(await route(lambdaEvent('GET', '/api/assessments', { token }))).assignments;
    assert.equal(mine.some((row) => row.timePoint === 'baseline'), false);

    const hidden = await route(lambdaEvent('GET', `/api/assessments/${id}`, { token }));
    assert.equal(hidden.statusCode, 404);
    const blocked = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token,
      body: { responses: answersFor('loss_characteristics') },
    }));
    assert.equal(blocked.statusCode, 404);
    const still = await getItem(TABLES.ASSESSMENTS, { id });
    assert.equal(still.status, stored.status);
    assert.equal(still.responses.lc_kinship, 'Spouse');

    const reminders = await processAssessmentReminders();
    assert.equal(reminders.sent, 0);
    const afterReminder = await getItem(TABLES.ASSESSMENTS, { id });
    assert.equal(afterReminder.last_reminded_at, null);

    const adminView = await route(lambdaEvent('GET', `/api/assessments/${id}`, { token: adminToken }));
    assert.equal(adminView.statusCode, 200);
    assert.equal(parse(adminView).assignment.timePoint, 'baseline');
    assert.equal(parse(adminView).assignment.responses.lc_kinship, 'Spouse');
  });

  test('a stored baseline schedule does not create new participant assignments', async () => {
    const adminToken = await seedAdmin();
    const registered = parse(await route(lambdaEvent('POST', '/api/auth/register', {
      body: { email: 'sched@example.com', password: 'Secret1!' },
    })));
    const saved = await route(lambdaEvent('PUT', '/api/admin/assessments/schedule', {
      token: adminToken,
      body: { timePoints: [BASELINE_TIME_POINT] },
    }));
    assert.equal(saved.statusCode, 200, parse(saved).error);
    const assigned = await route(lambdaEvent('POST', '/api/admin/assessments/assign', {
      token: adminToken,
      body: { uid: registered.user.uid },
    }));
    assert.equal(assigned.statusCode, 200, parse(assigned).error);
    assert.equal(parse(assigned).created, 0);
    const rows = (await scan(TABLES.ASSESSMENTS)).filter((r) => r.user_id === registered.user.uid);
    assert.equal(rows.length, 0);
  });

  test('matching does not require baseline and the admin list has no baseline indicator', async () => {
    const adminToken = await seedAdmin();
    const a = parse(await route(lambdaEvent('POST', '/api/auth/register', {
      body: { email: 'a@example.com', password: 'Secret1!', displayName: 'A' },
    })));
    const b = parse(await route(lambdaEvent('POST', '/api/auth/register', {
      body: { email: 'b@example.com', password: 'Secret1!', displayName: 'B' },
    })));

    const matched = await route(lambdaEvent('POST', '/api/admin/matches', {
      token: adminToken,
      body: { uid: a.user.uid, matchUid: b.user.uid },
    }));
    assert.equal(matched.statusCode, 200, parse(matched).error);

    const listed = await route(lambdaEvent('GET', '/api/admin/users', { token: adminToken }));
    const userA = parse(listed).users.find((u) => u.uid === a.user.uid);
    assert.equal(userA.baselineComplete, undefined);
    assert.equal(userA.baselineStatus, undefined);
    assert.equal(userA.email, 'a@example.com');
    const rows = (await scan(TABLES.ASSESSMENTS)).filter((r) => r.user_id === a.user.uid);
    assert.equal(rows.some((r) => r.time_point === 'week8' || r.time_point === 'baseline'), false);
  });

  test('intake saves INQ and C-SSRS question 1 without assigning baseline', async () => {
    const survey = await route(lambdaEvent('GET', '/api/assessments/intake'));
    assert.equal(survey.statusCode, 200);
    const spec = parse(survey);
    assert.equal(spec.inq.items.length, 15);
    assert.deepEqual(spec.cssrs.items.map((item) => item.id), ['cssrs_s1']);
    assert.equal(spec.cssrs.items.some((item) => item.id === 'cssrs_s2'), false);

    const inqResponses = answersFor('inq15', { inq_1: '7', inq_7: '1' });
    const registered = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'p4@example.com',
        password: 'Secret1!',
        inqResponses,
        cssrsIntake: 'No',
      },
    }));
    assert.equal(registered.statusCode, 201);
    const uid = parse(registered).user.uid;
    const token = parse(registered).token;
    assert.equal(parse(registered).screeningLink.eligibilityConfirmed, false);

    const inqRow = await getItem(TABLES.ASSESSMENTS, { id: `asg:${uid}:inq15:intake` });
    assert.equal(inqRow.status, 'complete');
    assert.equal(inqRow.time_point, 'intake');
    assert.equal(inqRow.responses.inq_1, '7');
    assert.equal(inqRow.responses.inq_7, '1');
    assert.equal(Object.keys(inqRow.responses).length, 15);
    assert.equal(inqRow.redcap_export_status, 'unconfigured');

    const cssrsRow = await getItem(TABLES.ASSESSMENTS, { id: `asg:${uid}:cssrs_intake:intake` });
    assert.equal(cssrsRow.status, 'complete');
    assert.deepEqual(cssrsRow.responses, { cssrs_s1: 'No' });
    assert.equal(cssrsRow.responses.cssrs_s2, undefined);

    const mine = parse(await route(lambdaEvent('GET', '/api/assessments', { token }))).assignments;
    const mineIds = mine.map((row) => row.instrumentId);
    assert.equal(mineIds.includes('inq15'), false);
    assert.equal(mineIds.includes('cssrs_intake'), false);
    assert.equal(mineIds.includes('loss_characteristics'), false);

    const rejected = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'p4b@example.com',
        password: 'Secret1!',
        inqResponses: answersFor('inq15', { inq_1: '8' }),
        cssrsIntake: 'No',
      },
    }));
    assert.equal(rejected.statusCode, 400);
  });

  test('week8 still prefills shared profile fields', async () => {
    const lossDate = '2020-01-01';
    const registered = await route(lambdaEvent('POST', '/api/auth/register', {
      body: {
        email: 'sync@example.com',
        password: 'Secret1!',
        kinship: 'Partner',
        cause: 'Natural',
        hobbies: 'gardening',
        lossDate,
      },
    }));
    assert.equal(registered.statusCode, 201);
    const uid = parse(registered).user.uid;
    const token = parse(registered).token;
    await assignFollowUpForUsers([uid], { interventionStartAt: Date.now() - 20 * 24 * 60 * 60 * 1000 });
    const pgId = `asg:${uid}:pg13r:week8`;
    const pg = await getItem(TABLES.ASSESSMENTS, { id: pgId });
    assert.equal(pg.time_point, 'week8');
    assert.equal(pg.responses.pg13_lost, 'Yes');
    assert.equal(pg.responses.pg13_months, monthsSinceLoss(lossDate));

    const patched = await route(lambdaEvent('PATCH', '/api/auth/me', {
      token,
      body: { lossDate: '2024-06-01', hobbies: 'painting' },
    }));
    assert.equal(patched.statusCode, 200);
    const pgAfter = await getItem(TABLES.ASSESSMENTS, { id: pgId });
    assert.equal(pgAfter.responses.pg13_months, monthsSinceLoss('2024-06-01'));
    assert.equal(pgAfter.responses.pg13_lost, 'Yes');
    assert.equal((await scan(TABLES.ASSESSMENTS)).some((r) => r.user_id === uid && r.time_point === 'baseline'), false);
  });
});
