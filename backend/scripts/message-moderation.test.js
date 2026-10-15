/**
 * Participant reports vs admin memos, privacy, and review-flag persistence.
 * Run: cd backend && MEMORY_DB=true STUB_AUTH=true STUB_AUTH_SECRET=test-secret node --test scripts/message-moderation.test.js
 */
process.env.MEMORY_DB = 'true';
process.env.STUB_AUTH = 'true';
process.env.STUB_AUTH_SECRET = 'test-secret';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_INVITE = 'false';
process.env.SIMPATICO_ENV = 'local';
delete process.env.SES_FROM_EMAIL;

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { resetMemoryDb } from '../shared/memoryDb.js';
import { putItem, getItem, TABLES } from '../shared/database.js';
import { route } from '../functions/api/router.js';
import { includeStaffMessageFields } from '../shared/messageModeration.js';

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

async function seedUser(id, extras = {}) {
  const now = Date.now();
  const user = {
    id,
    email: extras.email || `${id}@local`,
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

async function seedPeerConvo(uidA, uidB, extras = {}) {
  const [a, b] = [uidA, uidB].sort();
  const id = `${a}+${b}`;
  const now = Date.now();
  const convo = {
    id,
    users: [a, b],
    requester: uidA,
    recipient: uidB,
    consent_by: [uidA, uidB],
    mutual_consent: true,
    is_closed: false,
    moderation_status: 'active',
    needs_review: false,
    high_priority: false,
    report_count: 0,
    has_unread_by: [],
    last_msg_at: now,
    last_msg_preview: 'hello',
    last_sender_id: uidB,
    created_at: now,
    updated_at: now,
    ...extras,
  };
  await putItem(TABLES.CONVERSATIONS, convo);
  await putItem(TABLES.MESSAGES, {
    conversation_id: id,
    message_id: 'msg-1',
    body: 'hello from partner',
    sent_from_uid: uidB,
    sent_from_display_name: uidB,
    status: 'sent',
    reports: [],
    admin_notes: [],
    created_at: now - 1000,
  });
  return convo;
}

async function getMessages(token, conversationId) {
  return route(lambdaEvent('GET', '/api/messages', {
    token,
    query: { conversationId },
  }));
}

describe('message reports and admin memos', { concurrency: 1 }, () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  test('includeStaffMessageFields is false for participants, including dual-role admins', () => {
    assert.equal(includeStaffMessageFields({
      isAdmin: false,
      viewerUid: 'p1',
      participantUids: ['p1', 'p2'],
    }), false);
    assert.equal(includeStaffMessageFields({
      isAdmin: true,
      viewerUid: 'p1',
      participantUids: ['p1', 'p2'],
    }), false);
    assert.equal(includeStaffMessageFields({
      isAdmin: true,
      viewerUid: 'ra-1',
      participantUids: ['p1', 'p2'],
    }), true);
  });

  test('participant cannot write an admin memo', async () => {
    await seedUser('p1');
    await seedUser('p2');
    const convo = await seedPeerConvo('p1', 'p2');
    const res = await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('p1'),
      body: { conversationId: convo.id, messageId: 'msg-1', body: 'internal note' },
    }));
    assert.equal(res.statusCode, 403);
  });

  test('admin memo persists with author and timestamp; second admin can read it', async () => {
    await seedUser('p1', { display_name: 'Pat' });
    await seedUser('p2', { display_name: 'Riley' });
    await seedUser('ra-1', { is_admin: true, display_name: 'Yuka' });
    await seedUser('ra-2', { is_admin: true, display_name: 'Alex' });
    const convo = await seedPeerConvo('p1', 'p2');

    const saved = await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('ra-1'),
      body: {
        conversationId: convo.id,
        messageId: 'msg-1',
        body: 'Reviewed reported message. No immediate safety concern. Yuka following up tomorrow.',
      },
    }));
    assert.equal(saved.statusCode, 200);
    const note = parse(saved).message?.adminNotes?.[0];
    assert.ok(note);
    assert.equal(note.authorUid, 'ra-1');
    assert.equal(note.authorName, 'Yuka');
    assert.equal(note.body.includes('Yuka following up tomorrow'), true);
    assert.equal(typeof note.createdAt, 'number');

    const stored = await getItem(TABLES.MESSAGES, {
      conversation_id: convo.id,
      message_id: 'msg-1',
    });
    assert.equal(stored.admin_notes.length, 1);
    assert.equal(stored.admin_notes[0].authorUid, 'ra-1');

    const listed = await getMessages(signStubToken('ra-2'), convo.id);
    assert.equal(listed.statusCode, 200);
    const staffNotes = parse(listed).messages[0].adminNotes;
    assert.equal(staffNotes.length, 1);
    assert.equal(staffNotes[0].authorName, 'Yuka');
  });

  test('participant GET does not include adminNotes or reports', async () => {
    await seedUser('p1');
    await seedUser('p2');
    await seedUser('ra-1', { is_admin: true, display_name: 'Yuka' });
    const convo = await seedPeerConvo('p1', 'p2');

    await route(lambdaEvent('POST', '/api/messages/report', {
      token: signStubToken('p1'),
      body: { conversationId: convo.id, messageId: 'msg-1', explanation: 'This felt concerning to me.' },
    }));
    await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, messageId: 'msg-1', body: 'Staff-only handoff.' },
    }));

    const res = await getMessages(signStubToken('p1'), convo.id);
    assert.equal(res.statusCode, 200);
    const msg = parse(res).messages[0];
    assert.equal(msg.reportedByMe, true);
    assert.equal(msg.adminNotes, undefined);
    assert.equal(msg.reports, undefined);
    assert.equal(String(msg.body || '').includes('Staff-only'), false);
  });

  test('dual-role admin who is a participant does not receive staff fields', async () => {
    await seedUser('p1', { is_admin: true, display_name: 'Pat Admin' });
    await seedUser('p2');
    await seedUser('ra-1', { is_admin: true, display_name: 'Yuka' });
    const convo = await seedPeerConvo('p1', 'p2');

    await route(lambdaEvent('POST', '/api/messages/report', {
      token: signStubToken('p1'),
      body: { conversationId: convo.id, messageId: 'msg-1', explanation: 'Flagging this for the team.' },
    }));
    await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, messageId: 'msg-1', body: 'Do not show this in chat.' },
    }));

    const asParticipant = await getMessages(signStubToken('p1'), convo.id);
    assert.equal(asParticipant.statusCode, 200);
    const chatMsg = parse(asParticipant).messages[0];
    assert.equal(chatMsg.adminNotes, undefined);
    assert.equal(chatMsg.reports, undefined);

    const asMonitor = await getMessages(signStubToken('ra-1'), convo.id);
    assert.equal(asMonitor.statusCode, 200);
    const staffMsg = parse(asMonitor).messages[0];
    assert.ok(Array.isArray(staffMsg.adminNotes));
    assert.equal(staffMsg.adminNotes[0].body, 'Do not show this in chat.');
    assert.ok(Array.isArray(staffMsg.reports));
    assert.equal(staffMsg.reports.length, 1);
  });

  test('participant cannot read another conversation or attach a memo via swapped ids', async () => {
    await seedUser('p1');
    await seedUser('p2');
    await seedUser('p3');
    await seedUser('p4');
    const theirs = await seedPeerConvo('p1', 'p2');
    const mine = await seedPeerConvo('p3', 'p4');

    const peek = await getMessages(signStubToken('p3'), theirs.id);
    assert.equal(peek.statusCode, 403);

    const swapped = await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('p3'),
      body: { conversationId: theirs.id, messageId: 'msg-1', body: 'should not land' },
    }));
    assert.equal(swapped.statusCode, 403);

    const wrongKey = await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('p3'),
      body: { conversationId: mine.id, messageId: 'does-not-exist', body: 'nope' },
    }));
    assert.equal(wrongKey.statusCode, 403);
  });

  test('report flags the conversation for review; saving a memo does not clear it', async () => {
    await seedUser('p1');
    await seedUser('p2');
    await seedUser('ra-1', { is_admin: true, display_name: 'Yuka' });
    const convo = await seedPeerConvo('p1', 'p2');

    const reported = await route(lambdaEvent('POST', '/api/messages/report', {
      token: signStubToken('p1'),
      body: { conversationId: convo.id, messageId: 'msg-1', explanation: 'Please take a look at this.' },
    }));
    assert.equal(reported.statusCode, 200);
    assert.equal(parse(reported).message?.adminNotes, undefined);
    assert.equal(parse(reported).message?.reports, undefined);

    const afterReport = await getItem(TABLES.CONVERSATIONS, { id: convo.id });
    assert.equal(afterReport.needs_review, true);
    assert.equal(afterReport.report_count, 1);

    await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, messageId: 'msg-1', body: 'Reviewed. No action yet.' },
    }));

    const afterMemo = await getItem(TABLES.CONVERSATIONS, { id: convo.id });
    assert.equal(afterMemo.needs_review, true);
    assert.equal(afterMemo.report_count, 1);
    const msg = await getItem(TABLES.MESSAGES, {
      conversation_id: convo.id,
      message_id: 'msg-1',
    });
    assert.equal(msg.reports.length, 1);
    assert.equal(msg.admin_notes.length, 1);
  });

  test('clearing needs_review keeps reports, report_count, and memos', async () => {
    await seedUser('p1');
    await seedUser('p2');
    await seedUser('ra-1', { is_admin: true, display_name: 'Yuka' });
    const convo = await seedPeerConvo('p1', 'p2');

    await route(lambdaEvent('POST', '/api/messages/report', {
      token: signStubToken('p1'),
      body: { conversationId: convo.id, messageId: 'msg-1', explanation: 'Could the study team review this?' },
    }));
    await route(lambdaEvent('POST', '/api/admin/messages/notes', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, messageId: 'msg-1', body: 'Looked at this. History should stay.' },
    }));

    const cleared = await route(lambdaEvent('POST', '/api/admin/conversations/monitor', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, needsReview: false },
    }));
    assert.equal(cleared.statusCode, 200);
    const listed = parse(cleared).conversation;
    assert.equal(listed.needsReview, false);
    assert.equal(listed.reportCount, 1);

    const row = await getItem(TABLES.CONVERSATIONS, { id: convo.id });
    assert.equal(row.needs_review, false);
    assert.equal(row.report_count, 1);
    const msg = await getItem(TABLES.MESSAGES, {
      conversation_id: convo.id,
      message_id: 'msg-1',
    });
    assert.equal(msg.reports.length, 1);
    assert.equal(msg.reports[0].explanation.includes('study team review'), true);
    assert.equal(msg.admin_notes.length, 1);

    const staff = await getMessages(signStubToken('ra-1'), convo.id);
    const staffMsg = parse(staff).messages[0];
    assert.equal(staffMsg.reports.length, 1);
    assert.equal(staffMsg.adminNotes.length, 1);
  });

  test('conversation and participant memos persist for admins and stay hidden from participants', async () => {
    await seedUser('p1', { display_name: 'Pat' });
    await seedUser('p2', { display_name: 'Riley' });
    await seedUser('ra-1', { is_admin: true, display_name: 'Yuka' });
    await seedUser('ra-2', { is_admin: true, display_name: 'Alex' });
    const convo = await seedPeerConvo('p1', 'p2');

    const asParticipantNote = await route(lambdaEvent('POST', '/api/admin/conversations/notes', {
      token: signStubToken('p1'),
      body: { conversationId: convo.id, body: 'should not save' },
    }));
    assert.equal(asParticipantNote.statusCode, 403);

    const asParticipantUserNote = await route(lambdaEvent('POST', '/api/admin/users/notes', {
      token: signStubToken('p1'),
      body: { uid: 'p1', body: 'should not save either' },
    }));
    assert.equal(asParticipantUserNote.statusCode, 403);

    const convoSaved = await route(lambdaEvent('POST', '/api/admin/conversations/notes', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, body: 'Pair check-in scheduled for Thursday.' },
    }));
    assert.equal(convoSaved.statusCode, 200);
    assert.equal(parse(convoSaved).conversation.adminNotes[0].authorName, 'Yuka');
    assert.equal(parse(convoSaved).conversation.needsReview, false);

    const userSaved = await route(lambdaEvent('POST', '/api/admin/users/notes', {
      token: signStubToken('ra-1'),
      body: { uid: 'p1', body: 'Pat still finishing baseline. Follow up Friday.' },
    }));
    assert.equal(userSaved.statusCode, 200);
    assert.equal(parse(userSaved).user.adminNotes[0].body.includes('Follow up Friday'), true);
    assert.equal(parse(userSaved).user.adminNotes[0].authorUid, 'ra-1');

    const adminConvos = await route(lambdaEvent('GET', '/api/admin/conversations', {
      token: signStubToken('ra-2'),
    }));
    const staffConvo = parse(adminConvos).conversations.find((c) => c.docID === convo.id);
    assert.equal(staffConvo.adminNotes.length, 1);

    const adminUsers = await route(lambdaEvent('GET', '/api/admin/users', {
      token: signStubToken('ra-2'),
    }));
    const staffUser = parse(adminUsers).users.find((u) => u.uid === 'p1');
    assert.equal(staffUser.adminNotes.length, 1);

    const participantConvos = await route(lambdaEvent('GET', '/api/conversations', {
      token: signStubToken('p1'),
    }));
    assert.equal(participantConvos.statusCode, 200);
    const participantConvo = parse(participantConvos).conversations.find((c) => c.docID === convo.id);
    assert.ok(participantConvo);
    assert.equal(participantConvo.adminNotes, undefined);

    const me = await route(lambdaEvent('GET', '/api/auth/me', { token: signStubToken('p1') }));
    assert.equal(me.statusCode, 200);
    assert.equal(parse(me).userData.adminNotes, undefined);
  });

  test('conversation assignment is admin-only and never returned to participants', async () => {
    await seedUser('p1', { display_name: 'Pat' });
    await seedUser('p2', { display_name: 'Riley' });
    await seedUser('ra-1', { is_admin: true, display_name: 'Yuka' });
    await seedUser('ra-2', { is_admin: true, display_name: 'Alex' });
    const convo = await seedPeerConvo('p1', 'p2');

    const blocked = await route(lambdaEvent('POST', '/api/admin/conversations/assign', {
      token: signStubToken('p1'),
      body: { conversationId: convo.id, uid: 'ra-1' },
    }));
    assert.equal(blocked.statusCode, 403);

    const notAdmin = await route(lambdaEvent('POST', '/api/admin/conversations/assign', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, uid: 'p2' },
    }));
    assert.equal(notAdmin.statusCode, 400);

    const assigned = await route(lambdaEvent('POST', '/api/admin/conversations/assign', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, uid: 'ra-2' },
    }));
    assert.equal(assigned.statusCode, 200);
    const staffShape = parse(assigned).conversation;
    assert.equal(staffShape.assignedToUid, 'ra-2');
    assert.equal(staffShape.assignedToName, 'Alex');
    assert.equal(staffShape.assignedByUid, 'ra-1');

    const listed = await route(lambdaEvent('GET', '/api/admin/conversations', {
      token: signStubToken('ra-2'),
    }));
    const row = parse(listed).conversations.find((c) => c.docID === convo.id);
    assert.equal(row.assignedToUid, 'ra-2');

    const participantList = await route(lambdaEvent('GET', '/api/conversations', {
      token: signStubToken('p1'),
    }));
    const participantConvo = parse(participantList).conversations.find((c) => c.docID === convo.id);
    assert.ok(participantConvo);
    assert.equal(participantConvo.assignedToUid, undefined);
    assert.equal(participantConvo.assignedToName, undefined);
    assert.equal(participantConvo.assignedByUid, undefined);
    assert.equal(participantConvo.assignedByName, undefined);

    const dualRole = await seedUser('p1-admin', { is_admin: true, display_name: 'Pat Admin' });
    await putItem(TABLES.CONVERSATIONS, {
      ...(await getItem(TABLES.CONVERSATIONS, { id: convo.id })),
      users: ['p1-admin', 'p2'],
    });
    const asParticipantAdmin = await route(lambdaEvent('GET', '/api/conversations', {
      token: signStubToken(dualRole.id),
    }));
    const dualConvo = parse(asParticipantAdmin).conversations.find((c) => c.docID === convo.id);
    assert.ok(dualConvo);
    assert.equal(dualConvo.assignedToUid, undefined);
    assert.equal(dualConvo.assignedToName, undefined);

    const cleared = await route(lambdaEvent('POST', '/api/admin/conversations/assign', {
      token: signStubToken('ra-1'),
      body: { conversationId: convo.id, uid: null },
    }));
    assert.equal(cleared.statusCode, 200);
    assert.equal(parse(cleared).conversation.assignedToUid, null);
    const stored = await getItem(TABLES.CONVERSATIONS, { id: convo.id });
    assert.equal(stored.assigned_to_uid, undefined);
  });
});
