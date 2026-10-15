/**
 * Staff C-SSRS screening entry onto an enrolled participant.
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret node --test scripts/cssrs-screening.test.js
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
import { putItem, getItem, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';
import {
  BASELINE_INSTRUMENT_IDS,
  WEEK8_INSTRUMENT_IDS,
  getInstrument,
} from '../shared/assessments/instruments.js';

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

function noIdeation() {
  return {
    cssrs_s1: 'No',
    cssrs_s2: 'No',
    cssrs_s6: 'No',
  };
}

describe('C-SSRS staff screening', { concurrency: 1 }, () => {
  beforeEach(async () => {
    process.env.REQUIRE_INVITE = 'false';
    await resetMemoryDb();
  });

  test('screening instrument is staff-only and not assigned with baseline or week 8', () => {
    const def = getInstrument('cssrs_screening');
    assert.equal(def.staffOnly, true);
    assert.equal(def.items.length, 7);
    assert.equal(BASELINE_INSTRUMENT_IDS.includes('cssrs_screening'), false);
    assert.equal(WEEK8_INSTRUMENT_IDS.includes('cssrs_screening'), false);
    assert.deepEqual(getInstrument('cssrs_intake').items.map((item) => item.id), ['cssrs_s1']);
    assert.equal(def.items.some((item) => item.id === 'cssrs_s2'), true);
    assert.equal(getInstrument('cssrs'), null);
  });

  test('RA entry is stored on the enrolled participant and skipped for REDCap until mapping is confirmed', async () => {
    const adminToken = await seedAdmin();
    const registered = await route(lambdaEvent('POST', '/api/auth/register', {
      body: { email: 'p@example.com', password: 'Secret1!' },
    }));
    const uid = parse(registered).user.uid;
    const participantToken = parse(registered).token;

    const saved = await route(lambdaEvent('POST', '/api/admin/assessments/cssrs', {
      token: adminToken,
      body: {
        uid,
        screenerReference: 'anon-441',
        responses: {
          ...noIdeation(),
          cssrs_s3: 'Yes',
        },
      },
    }));
    assert.equal(saved.statusCode, 200, parse(saved).error);
    const assignment = parse(saved).assignment;
    assert.equal(assignment.uid, uid);
    assert.equal(assignment.instrumentId, 'cssrs_screening');
    assert.equal(assignment.timePoint, 'screening');
    assert.equal(assignment.redcapExportStatus, 'unconfigured');
    assert.equal(assignment.enteredBy, 'admin-1');
    assert.equal(assignment.entrySource, 'staff_zoom');
    assert.equal(assignment.screenerReference, 'anon-441');

    const id = `asg:${uid}:cssrs_screening:screening`;
    const row = await getItem(TABLES.ASSESSMENTS, { id });
    assert.equal(row.responses.cssrs_s1, 'No');
    assert.equal(row.responses.cssrs_s3, undefined);
    assert.equal(row.record_scope, 'enrolled_participant');

    const mine = await route(lambdaEvent('GET', '/api/assessments', { token: participantToken }));
    assert.equal(mine.statusCode, 200);
    assert.equal(parse(mine).assignments.some((row) => row.instrumentId === 'cssrs_screening'), false);

    const hidden = await route(lambdaEvent('GET', `/api/assessments/${id}`, { token: participantToken }));
    assert.equal(hidden.statusCode, 404);

    const blocked = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: participantToken,
      body: { responses: noIdeation() },
    }));
    assert.equal(blocked.statusCode, 403);

    const denied = await route(lambdaEvent('POST', '/api/admin/assessments/cssrs', {
      token: participantToken,
      body: { uid, responses: noIdeation() },
    }));
    assert.equal(denied.statusCode, 403);
  });

  test('yes on question 2 requires questions 3 through 5, and a later save stays on the same record', async () => {
    const adminToken = await seedAdmin();
    const registered = await route(lambdaEvent('POST', '/api/auth/register', {
      body: { email: 'p2@example.com', password: 'Secret1!' },
    }));
    const uid = parse(registered).user.uid;

    const incomplete = await route(lambdaEvent('POST', '/api/admin/assessments/cssrs', {
      token: adminToken,
      body: { uid, responses: { cssrs_s1: 'No', cssrs_s2: 'Yes', cssrs_s6: 'No' } },
    }));
    assert.equal(incomplete.statusCode, 400);

    const saved = await route(lambdaEvent('POST', '/api/admin/assessments/cssrs', {
      token: adminToken,
      body: {
        uid,
        responses: {
          cssrs_s1: 'Yes',
          cssrs_s2: 'Yes',
          cssrs_s3: 'No',
          cssrs_s4: 'No',
          cssrs_s5: 'No',
          cssrs_s6: 'Yes',
          cssrs_s6_past3: 'No',
        },
      },
    }));
    assert.equal(saved.statusCode, 200, parse(saved).error);

    const again = await route(lambdaEvent('POST', '/api/admin/assessments/cssrs', {
      token: adminToken,
      body: { uid, responses: noIdeation() },
    }));
    assert.equal(again.statusCode, 200);
    assert.equal(parse(again).assignment.id, parse(saved).assignment.id);
    const row = await getItem(TABLES.ASSESSMENTS, { id: parse(saved).assignment.id });
    assert.equal(row.responses.cssrs_s2, 'No');
    assert.equal(row.responses.cssrs_s3, undefined);
    assert.equal(row.responses.cssrs_s6_past3, undefined);
  });

  test('unknown participant and missing uid are rejected', async () => {
    const adminToken = await seedAdmin();
    const missing = await route(lambdaEvent('POST', '/api/admin/assessments/cssrs', {
      token: adminToken,
      body: { responses: noIdeation() },
    }));
    assert.equal(missing.statusCode, 400);
    const unknown = await route(lambdaEvent('POST', '/api/admin/assessments/cssrs', {
      token: adminToken,
      body: { uid: 'nobody', responses: noIdeation() },
    }));
    assert.equal(unknown.statusCode, 404);
  });
});
