/**
 * Distress Thermometer safety workflow tests (MEMORY_DB).
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true node --test scripts/distress-safety.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
delete process.env.SES_FROM_EMAIL;

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, getItem, scan, TABLES } from '../shared/database.js';
import { processDistressSubmission } from '../shared/distressSafety.js';
import { config } from '../shared/config.js';

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

async function seedUser(id, extras = {}) {
  const now = Date.now();
  const user = {
    id,
    email: `${id}@local`,
    display_name: id,
    is_admin: false,
    email_verified: true,
    chat_disabled: false,
    simpatico_match: extras.simpatico_match || 'user-partner',
    contacts: [],
    created_at: now,
    updated_at: now,
    ...extras,
  };
  await putItem(TABLES.USERS, user);
  return user;
}

async function seedPeerConvo(userId, partnerId, extras = {}) {
  const [a, b] = [userId, partnerId].sort();
  const id = `${a}+${b}`;
  const now = Date.now();
  const convo = {
    id,
    users: [a, b],
    requester: userId,
    recipient: partnerId,
    consent_by: [userId, partnerId],
    mutual_consent: true,
    is_closed: false,
    moderation_status: 'active',
    has_unread_by: [],
    last_msg_at: now,
    last_msg_preview: 'hello',
    last_sender_id: partnerId,
    created_at: now,
    updated_at: now,
    ...extras,
  };
  await putItem(TABLES.CONVERSATIONS, convo);
  await putItem(TABLES.MESSAGES, {
    conversation_id: id,
    message_id: 'msg-existing-1',
    body: 'hello from before distress',
    sent_from_uid: partnerId,
    status: 'sent',
    created_at: now - 1000,
  });
  return convo;
}

let route;

beforeEach(async () => {
  resetMemoryDb();
  if (!route) {
    ({ route } = await import('../functions/api/router.js'));
  }
});

test('score 60 is persisted, chat stays enabled, no study notify', async () => {
  const uid = 'user-low';
  await seedUser(uid);
  await seedPeerConvo(uid, 'user-partner');
  const token = signStubToken(uid);
  let notified = 0;

  const core = await processDistressSubmission({
    userId: uid,
    score: 60,
    notify: async () => {
      notified += 1;
      return { sent: true, mode: 'ses' };
    },
  });
  assert.equal(core.status, 'recorded');
  assert.equal(core.chatDisabled, false);
  assert.equal(core.notified, false);
  assert.equal(notified, 0);

  const apiRes = await route(
    lambdaEvent('POST', '/api/distress', { token, body: { score: 40 } })
  );
  assert.equal(apiRes.statusCode, 200);
  const apiBody = parse(apiRes);
  assert.equal(apiBody.score, 40);
  assert.equal(apiBody.chatDisabled, false);
  assert.equal(apiBody.notifyFailed, false);

  const events = (await scan(TABLES.DISTRESS_EVENTS)).filter((e) => e.user_id === uid);
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.score < 70));
  assert.ok(events.every((e) => e.status === 'recorded'));

  const user = await getItem(TABLES.USERS, { id: uid });
  assert.equal(user.chat_disabled, false);

  const sendRes = await route(
    lambdaEvent('POST', '/api/messages/send', {
      token,
      body: { conversationId: `${['user-low', 'user-partner'].sort().join('+')}`, body: 'still chatting' },
    })
  );
  assert.equal(sendRes.statusCode, 200);
});

test('score 70 as a non-admin suspends chat, keeps messages, notifies, and blocks peer send', async () => {
  const uid = 'user-high';
  const partner = 'user-partner';
  await seedUser(uid);
  const convo = await seedPeerConvo(uid, partner);
  const token = signStubToken(uid);

  const res = await route(
    lambdaEvent('POST', '/api/distress', { token, body: { score: 70 } })
  );
  assert.equal(res.statusCode, 200);
  const body = parse(res);
  assert.equal(body.score, 70);
  assert.equal(body.chatDisabled, true);
  assert.equal(body.notified, true);
  assert.equal(body.notifyFailed, false);
  assert.equal(body.status, 'sent');

  const user = await getItem(TABLES.USERS, { id: uid });
  assert.equal(user.chat_disabled, true);
  assert.equal(user.simpatico_match, 'user-partner');

  const existing = await getItem(TABLES.MESSAGES, {
    conversation_id: convo.id,
    message_id: 'msg-existing-1',
  });
  assert.equal(existing.body, 'hello from before distress');

  const event = await getItem(TABLES.DISTRESS_EVENTS, { id: body.eventId });
  assert.equal(event.score, 70);
  assert.equal(event.chat_suspended, true);
  assert.equal(event.status, 'sent');

  const sendRes = await route(
    lambdaEvent('POST', '/api/messages/send', {
      token,
      body: { conversationId: convo.id, body: 'should be blocked' },
    })
  );
  assert.equal(sendRes.statusCode, 403);
  assert.match(parse(sendRes).message, /suspended/i);

  const newPeer = await route(
    lambdaEvent('POST', '/api/conversations', {
      token,
      body: { initiatorUid: uid, otherUid: 'someone-else' },
    })
  );
  assert.equal(newPeer.statusCode, 403);

  await seedUser('admin-1', { is_admin: true });
  const adminToken = signStubToken('admin-1');
  const listRes = await route(
    lambdaEvent('GET', '/api/admin/distress', {
      token: adminToken,
      query: { uid },
    })
  );
  assert.equal(listRes.statusCode, 200);
  const listed = parse(listRes).events;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].score, 70);
  assert.equal(listed[0].status, 'sent');
});

test('high-score participant can still message Study Support', async () => {
  const uid = 'user-support-ok';
  const supportUid = config.supportUid;
  await seedUser(uid);
  await seedUser(supportUid, { is_support: true, email: 'support@local' });
  const supportConvo = await seedPeerConvo(uid, supportUid, { type: 'support' });
  const token = signStubToken(uid);

  const distressRes = await route(
    lambdaEvent('POST', '/api/distress', { token, body: { score: 80 } })
  );
  assert.equal(distressRes.statusCode, 200);
  assert.equal(parse(distressRes).chatDisabled, true);

  const sendRes = await route(
    lambdaEvent('POST', '/api/messages/send', {
      token,
      body: { conversationId: supportConvo.id, body: 'I need help' },
    })
  );
  assert.equal(sendRes.statusCode, 200);
});

test('notify failure still suspends chat, records admin follow-up, and does not claim notify success', async () => {
  const uid = 'user-notify-fail';
  await seedUser(uid);

  const result = await processDistressSubmission({
    userId: uid,
    score: 90,
    notify: async () => ({ sent: false, mode: 'ses-error', error: 'SES boom' }),
  });

  assert.equal(result.chatDisabled, true);
  assert.equal(result.notified, false);
  assert.equal(result.notifyFailed, true);
  assert.equal(result.status, 'notify_failed');
  assert.match(result.notifyError, /SES boom/);

  const user = await getItem(TABLES.USERS, { id: uid });
  assert.equal(user.chat_disabled, true);

  const event = await getItem(TABLES.DISTRESS_EVENTS, { id: result.eventId });
  assert.equal(event.status, 'notify_failed');
  assert.equal(event.chat_suspended, true);
  assert.equal(event.notify_error, 'SES boom');

  const audits = await scan(TABLES.AUDIT_LOGS);
  assert.ok(audits.some((a) => a.event_type === 'distress_notify_failed'));
});

test('participant cannot use the admin chat-disable endpoint', async () => {
  const uid = 'user-not-admin';
  await seedUser(uid);
  const token = signStubToken(uid);
  const res = await route(
    lambdaEvent('POST', '/api/admin/chat/disable', { token, body: { uid } })
  );
  assert.equal(res.statusCode, 403);
  const user = await getItem(TABLES.USERS, { id: uid });
  assert.equal(user.chat_disabled, false);
});

test('distress worker updateItem writes status=sent with a field map', async () => {
  const eventId = 'evt-worker-1';
  await putItem(TABLES.DISTRESS_EVENTS, {
    id: eventId,
    user_id: 'user-worker',
    score: 75,
    status: 'queued',
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  const { handler } = await import('../functions/distress/worker.js');
  const sqsEvent = {
    Records: [
      {
        body: JSON.stringify({
          eventId,
          userId: 'user-worker',
          score: 75,
          timestamp: Date.now(),
        }),
      },
    ],
  };
  const out = await handler(sqsEvent);
  const parsed = JSON.parse(out.body);
  assert.equal(parsed.results[0].status, 'success');
  const row = await getItem(TABLES.DISTRESS_EVENTS, { id: eventId });
  assert.equal(row.status, 'sent');
  assert.equal(row.notified, true);
  assert.ok(row.emailed_at);
  assert.equal(row.UpdateExpression, undefined);
});
