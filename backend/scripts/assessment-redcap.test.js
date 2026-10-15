/**
 * Assessment persistence + REDCap export-status tests (MEMORY_DB).
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret node --test scripts/assessment-redcap.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_INVITE = 'false';
process.env.SIMPATICO_ENV = 'local';
process.env.REDCAP_TIMEOUT_MS = '50';
delete process.env.REDCAP_API_URL;
delete process.env.REDCAP_API_TOKEN;
delete process.env.REDCAP_MAPPING_CONFIRMED;

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, getItem, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';

const nativeFetch = globalThis.fetch;
let fetchCalls = [];
let fetchImpl = null;

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

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

const ANSWERS = {
  s_understood: '4',
  s_helpful: '5',
  s_continue: '3',
  s_notes: 'fine',
};

async function seedAssignment({ admin = false } = {}) {
  const now = Date.now();
  await putItem(TABLES.USERS, {
    id: 'user-1',
    email: 'p1@local',
    display_name: 'P1',
    is_admin: false,
    email_verified: true,
    created_at: now,
    updated_at: now,
  });
  await putItem(TABLES.USERS, {
    id: 'admin-1',
    email: 'ra@local',
    display_name: 'RA',
    is_admin: true,
    email_verified: true,
    created_at: now,
    updated_at: now,
  });
  const id = 'asg:user-1:simpatico:baseline';
  await putItem(TABLES.ASSESSMENTS, {
    id,
    type: 'assignment',
    user_id: 'user-1',
    instrument_id: 'simpatico',
    time_point: 'baseline',
    time_point_label: 'Baseline (after match)',
    due_at: now,
    status: 'due',
    responses: null,
    completed_at: null,
    last_reminded_at: null,
    redcap_export_status: null,
    redcap_export_at: null,
    redcap_export_error: null,
    created_at: now,
    updated_at: now,
  });
  return {
    id,
    userToken: signStubToken('user-1'),
    adminToken: signStubToken('admin-1'),
    admin,
  };
}

function enableRedcapMapping() {
  process.env.REDCAP_API_URL = 'https://redcap.test/api/';
  process.env.REDCAP_API_TOKEN = 'super-secret-token';
  process.env.REDCAP_MAPPING_CONFIRMED = 'true';
}

function disableRedcap() {
  delete process.env.REDCAP_API_URL;
  delete process.env.REDCAP_API_TOKEN;
  delete process.env.REDCAP_MAPPING_CONFIRMED;
}

describe('assessment REDCap export status', { concurrency: 1 }, () => {
  beforeEach(async () => {
    disableRedcap();
    fetchCalls = [];
    fetchImpl = null;
    globalThis.fetch = async (...args) => {
      fetchCalls.push(args);
      if (fetchImpl) return fetchImpl(...args);
      throw new Error('unexpected fetch');
    };
    await resetMemoryDb();
  });

  afterEach(() => {
    globalThis.fetch = nativeFetch;
    disableRedcap();
  });

  test('submit persists responses and stays unconfigured without REDCap', async () => {
    const { id, userToken } = await seedAssignment();
    const res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(res.statusCode, 200);
    const data = parse(res);
    assert.equal(data.assignment.status, 'complete');
    assert.equal(data.assignment.redcapExportStatus, 'unconfigured');
    assert.equal(data.assignment.redcapExportError, 'credentials_missing');
    assert.equal(data.redcap, undefined);
    assert.equal(data.result, undefined);
    const row = await getItem(TABLES.ASSESSMENTS, { id });
    assert.equal(row.status, 'complete');
    assert.deepEqual(row.responses, ANSWERS);
    assert.equal(row.redcap_export_status, 'unconfigured');
    assert.equal(fetchCalls.length, 0);
  });

  test('credentials without mapping confirmation never POST to REDCap', async () => {
    process.env.REDCAP_API_URL = 'https://redcap.test/api/';
    process.env.REDCAP_API_TOKEN = 'super-secret-token';
    delete process.env.REDCAP_MAPPING_CONFIRMED;
    const { id, userToken } = await seedAssignment();
    const res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(res.statusCode, 200);
    const data = parse(res);
    assert.equal(data.assignment.status, 'complete');
    assert.equal(data.assignment.redcapExportStatus, 'unconfigured');
    assert.equal(data.assignment.redcapExportError, 'mapping_not_confirmed');
    assert.equal(fetchCalls.length, 0);
    const row = await getItem(TABLES.ASSESSMENTS, { id });
    assert.deepEqual(row.responses, ANSWERS);
  });

  test('HTTP 403 marks export failed and keeps responses', async () => {
    enableRedcapMapping();
    fetchImpl = async () => jsonResponse(403, { error: 'invalid token' });
    const logs = [];
    const origErr = console.error;
    console.error = (...args) => { logs.push(args.map(String).join(' ')); };
    try {
      const { id, userToken } = await seedAssignment();
      const res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
        token: signStubToken('admin-1'),
        body: { responses: ANSWERS },
      }));
      assert.equal(res.statusCode, 200);
      const data = parse(res);
      assert.equal(data.assignment.status, 'complete');
      assert.equal(data.assignment.redcapExportStatus, 'failed');
      assert.equal(data.assignment.redcapExportError, 'http_403');
      assert.equal(data.redcap, undefined);
      const row = await getItem(TABLES.ASSESSMENTS, { id });
      assert.deepEqual(row.responses, ANSWERS);
      const joined = logs.join('\n');
      assert.equal(joined.includes('super-secret-token'), false);
      assert.equal(joined.includes('invalid token'), false);
      assert.equal(joined.includes('fine'), false);
    } finally {
      console.error = origErr;
    }
  });

  test('network failure marks export failed', async () => {
    enableRedcapMapping();
    fetchImpl = async () => { throw new Error('ECONNREFUSED redcap.test'); };
    const { id, userToken } = await seedAssignment();
    const res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(parse(res).assignment.redcapExportStatus, 'failed');
    assert.equal(parse(res).assignment.redcapExportError, 'network');
    assert.equal(parse(res).assignment.status, 'complete');
  });

  test('timeout marks export failed', async () => {
    enableRedcapMapping();
    fetchImpl = async (_url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
    const { id, userToken } = await seedAssignment();
    const res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(parse(res).assignment.redcapExportStatus, 'failed');
    assert.equal(parse(res).assignment.redcapExportError, 'timeout');
    const row = await getItem(TABLES.ASSESSMENTS, { id });
    assert.deepEqual(row.responses, ANSWERS);
  });

  test('HTTP 200 JSON error is not treated as sent', async () => {
    enableRedcapMapping();
    fetchImpl = async () => jsonResponse(200, { error: 'Unknown field s_understood' });
    const { id, userToken } = await seedAssignment();
    const res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(parse(res).assignment.redcapExportStatus, 'failed');
    assert.equal(parse(res).assignment.redcapExportError, 'redcap_error');
  });

  test('missing or zero import count is failed', async () => {
    enableRedcapMapping();
    const { id, userToken } = await seedAssignment();
    fetchImpl = async () => jsonResponse(200, { count: 0 });
    let res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(parse(res).assignment.redcapExportStatus, 'failed');
    assert.equal(parse(res).assignment.redcapExportError, 'zero_count');

    fetchImpl = async () => jsonResponse(200, { ok: true });
    res = await route(lambdaEvent('POST', `/api/admin/assessments/${id}/redcap-retry`, {
      token: signStubToken('admin-1'),
      body: {},
    }));
    assert.equal(parse(res).assignment.redcapExportStatus, 'failed');
    assert.equal(parse(res).assignment.redcapExportError, 'missing_count');
  });

  test('count 1 is sent', async () => {
    enableRedcapMapping();
    fetchImpl = async () => jsonResponse(200, { count: 1 });
    const { id, userToken } = await seedAssignment();
    const res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(parse(res).assignment.redcapExportStatus, 'sent');
    assert.equal(parse(res).assignment.redcapExportError, null);
    assert.equal(parse(res).assignment.status, 'complete');
  });

  test('admin retry uses stored responses and does not change them', async () => {
    const { id, userToken, adminToken } = await seedAssignment();
    let res = await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    assert.equal(parse(res).assignment.redcapExportStatus, 'unconfigured');
    const before = await getItem(TABLES.ASSESSMENTS, { id });

    enableRedcapMapping();
    fetchImpl = async () => jsonResponse(200, { count: 1 });
    res = await route(lambdaEvent('POST', `/api/admin/assessments/${id}/redcap-retry`, {
      token: adminToken,
      body: {},
    }));
    assert.equal(res.statusCode, 200);
    assert.equal(parse(res).assignment.redcapExportStatus, 'sent');
    const after = await getItem(TABLES.ASSESSMENTS, { id });
    assert.deepEqual(after.responses, before.responses);
    assert.equal(after.status, 'complete');
    assert.equal(after.completed_at, before.completed_at);
  });

  test('participant cannot retry REDCap export', async () => {
    const { id, userToken } = await seedAssignment();
    await route(lambdaEvent('POST', `/api/assessments/${id}/submit`, {
      token: signStubToken('admin-1'),
      body: { responses: ANSWERS },
    }));
    const res = await route(lambdaEvent('POST', `/api/admin/assessments/${id}/redcap-retry`, {
      token: userToken,
      body: {},
    }));
    assert.equal(res.statusCode, 403);
  });
});
