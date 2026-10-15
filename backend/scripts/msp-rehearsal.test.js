/**
 * Local MSP dress rehearsal (MEMORY_DB). Covers the post-consent Share Pairs
 * path and the deliberate break cases. This is AI/automated coverage — not a
 * substitute for the later human run on the deployed study site.
 *
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret node --test scripts/msp-rehearsal.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_INVITE = 'true';
process.env.SIMPATICO_ENV = 'local';
process.env.ADMIN_EMAILS = '';
delete process.env.SES_FROM_EMAIL;
delete process.env.REDCAP_API_URL;
delete process.env.REDCAP_API_TOKEN;
delete process.env.REDCAP_MAPPING_CONFIRMED;

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, getItem, scan, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';
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

function convoId(a, b) {
  return [a, b].map(String).sort().join('+');
}

async function seedAdmin() {
  const now = Date.now();
  await putItem(TABLES.USERS, {
    id: 'ra-1',
    email: 'ra@study.local',
    display_name: 'RA',
    is_admin: true,
    email_verified: true,
    created_at: now,
    updated_at: now,
  });
  return signStubToken('ra-1');
}

async function inviteAndRegister(adminToken, { email, displayName }) {
  const created = await route(lambdaEvent('POST', '/api/admin/invites', {
    token: adminToken,
    body: {},
  }));
  assert.equal(created.statusCode, 201, parse(created).error);
  const code = parse(created).invite.code;
  const registered = await route(lambdaEvent('POST', '/api/auth/register', {
    body: {
      email,
      password: 'Secret1!',
      displayName,
      inviteCode: code,
    },
  }));
  assert.equal(registered.statusCode, 201, parse(registered).error);
  const data = parse(registered);
  return { uid: data.user.uid, token: data.token };
}

async function openPeerChat(aUid, aToken, bUid, bToken) {
  const created = await route(lambdaEvent('POST', '/api/conversations', {
    token: aToken,
    body: { initiatorUid: aUid, otherUid: bUid },
  }));
  assert.equal(created.statusCode, 200, parse(created).error);
  const consented = await route(lambdaEvent('POST', '/api/consent/request', {
    token: bToken,
    body: { matchId: aUid },
  }));
  assert.equal(consented.statusCode, 200, parse(consented).error);
  assert.equal(parse(consented).conversation?.mutualConsent || parse(consented).mutualConsent, true);
  return convoId(aUid, bUid);
}

describe('MSP local dress rehearsal', { concurrency: 1 }, () => {
  beforeEach(async () => {
    process.env.REQUIRE_INVITE = 'true';
    await resetMemoryDb();
  });

  test('invite → account → match → chat, then deliberate break cases', async () => {
    const adminToken = await seedAdmin();

    const publicReg = await route(lambdaEvent('POST', '/api/auth/register', {
      body: { email: 'stranger@example.com', password: 'Secret1!', displayName: 'Stranger' },
    }));
    assert.equal(publicReg.statusCode, 403);

    const a = await inviteAndRegister(adminToken, { email: 'p1@example.com', displayName: 'Pat' });
    const b = await inviteAndRegister(adminToken, { email: 'p2@example.com', displayName: 'Sam' });

    const listed = await route(lambdaEvent('GET', '/api/admin/users', { token: adminToken }));
    const users = parse(listed).users;
    const pat = users.find((u) => u.uid === a.uid);
    assert.equal(pat.email, 'p1@example.com');
    assert.equal(pat.baselineComplete, undefined);
    assert.equal(pat.studyConsent, false);

    const unauthorizedMatch = await route(lambdaEvent('POST', '/api/admin/matches', {
      token: a.token,
      body: { uid: a.uid, matchUid: b.uid },
    }));
    assert.equal(unauthorizedMatch.statusCode, 403);

    const matched = await route(lambdaEvent('POST', '/api/admin/matches', {
      token: adminToken,
      body: { uid: a.uid, matchUid: b.uid },
    }));
    assert.equal(matched.statusCode, 200, parse(matched).error);

    const afterMatch = (await scan(TABLES.ASSESSMENTS)).filter((r) => r.user_id === a.uid);
    assert.equal(afterMatch.some((r) => r.time_point === 'week8' || r.time_point === 'week4'), false);

    const cid = await openPeerChat(a.uid, a.token, b.uid, b.token);

    const firstSend = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'Hi Sam, this is Pat.' },
    }));
    assert.equal(firstSend.statusCode, 200, parse(firstSend).error);
    const firstMid = parse(firstSend).message?.id || parse(firstSend).id;
    assert.ok(firstMid);

    const dt60 = await route(lambdaEvent('POST', '/api/distress', {
      token: a.token,
      body: { score: 60 },
    }));
    assert.equal(dt60.statusCode, 200);
    assert.equal(parse(dt60).chatDisabled, false);
    const stillChatting = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'Still here after DT 60.' },
    }));
    assert.equal(stillChatting.statusCode, 200);

    const report = await route(lambdaEvent('POST', '/api/messages/report', {
      token: b.token,
      body: {
        conversationId: cid,
        messageId: firstMid,
        explanation: 'This message worried me.',
      },
    }));
    assert.equal(report.statusCode, 200, parse(report).error);
    const flagged = await getItem(TABLES.CONVERSATIONS, { id: cid });
    assert.equal(flagged.needs_review, true);

    const memo = await route(lambdaEvent('POST', '/api/admin/conversations/notes', {
      token: adminToken,
      body: { conversationId: cid, body: 'RA reviewed the report. No immediate safety concern.' },
    }));
    assert.equal(memo.statusCode, 200, parse(memo).error);

    const pause = await route(lambdaEvent('POST', '/api/admin/conversations/moderation', {
      token: adminToken,
      body: { conversationId: cid, status: 'paused' },
    }));
    assert.equal(pause.statusCode, 200, parse(pause).error);
    const pausedSend = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'should not send while paused' },
    }));
    assert.equal(pausedSend.statusCode, 403);

    const resume = await route(lambdaEvent('POST', '/api/admin/conversations/moderation', {
      token: adminToken,
      body: { conversationId: cid, status: 'active' },
    }));
    assert.equal(resume.statusCode, 200);

    const disable = await route(lambdaEvent('POST', '/api/admin/chat/disable', {
      token: adminToken,
      body: { uid: a.uid },
    }));
    assert.equal(disable.statusCode, 200);
    const disabledSend = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'should not send while chat-disabled' },
    }));
    assert.equal(disabledSend.statusCode, 403);

    const enable = await route(lambdaEvent('POST', '/api/admin/chat/enable', {
      token: adminToken,
      body: { uid: a.uid },
    }));
    assert.equal(enable.statusCode, 200);
    const reenabledSend = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'Back after re-enable.' },
    }));
    assert.equal(reenabledSend.statusCode, 200);

    const dt70 = await route(lambdaEvent('POST', '/api/distress', {
      token: a.token,
      body: { score: 70 },
    }));
    assert.equal(dt70.statusCode, 200);
    assert.equal(parse(dt70).chatDisabled, true);
    const distressSend = await route(lambdaEvent('POST', '/api/messages/send', {
      token: a.token,
      body: { conversationId: cid, body: 'should not send after DT 70' },
    }));
    assert.equal(distressSend.statusCode, 403);
    const userA = await getItem(TABLES.USERS, { id: a.uid });
    assert.equal(userA.chat_disabled, true);
    assert.ok(userA.simpatico_match);

    await route(lambdaEvent('POST', '/api/admin/chat/enable', {
      token: adminToken,
      body: { uid: a.uid },
    }));

    const terminate = await route(lambdaEvent('POST', '/api/admin/conversations/moderation', {
      token: adminToken,
      body: { conversationId: cid, status: 'terminated' },
    }));
    assert.equal(terminate.statusCode, 200);
    const terminatedSend = await route(lambdaEvent('POST', '/api/messages/send', {
      token: b.token,
      body: { conversationId: cid, body: 'should not send after terminate' },
    }));
    assert.equal(terminatedSend.statusCode, 403);
    const history = await route(lambdaEvent('GET', '/api/messages', {
      token: b.token,
      query: { conversationId: cid },
    }));
    assert.equal(history.statusCode, 200);
    const messages = parse(history).messages || parse(history).items || [];
    assert.ok(messages.length >= 2);
    assert.ok(messages.some((m) => String(m.body || '').includes('Hi Sam')));

    const participantAdmin = await route(lambdaEvent('GET', '/api/admin/distress', {
      token: b.token,
      query: { uid: a.uid },
    }));
    assert.equal(participantAdmin.statusCode, 403);

    const reset = await route(lambdaEvent('POST', '/api/auth/reset-password', {
      body: { email: 'p1@example.com' },
    }));
    assert.equal(reset.statusCode, 404);
  });
});
