/**
 * Local tutorial staging only.
 * Enabled when DEMO_TUTORIAL=true and this process is not the study site.
 * Never creates admin access and never sends email.
 */
import crypto from 'crypto';
import { deleteItem, getItem, putItem, scan, updateItem, TABLES } from './database.js';
import { getSimpaticoEnv, isLocalEnv } from './env.js';
import { config } from './config.js';
import { broadcastToUsers } from './broadcast.js';
import { assignFollowUpForUsers } from './assessments/service.js';
import { dueAtForOffset } from './assessments/schedule.js';
import { WEEK8_TIME_POINT } from './assessments/instruments.js';

export const DEMO_PARTICIPANT_ID = 'user-demo-participant';
export const DEMO_PARTNER_ID = 'user-demo-partner';
export const DEMO_LOGIN = 'demo';
export const DEMO_PASSWORD = 'demo';

/** Older baseline stage names still resolve. They no longer assign that battery. */
export const DEMO_STATES = [
  'account',
  'one-left',
  'baseline',
  'seed-answers',
  'baseline-complete',
  'waiting',
  'matched',
  'accept',
  'reply',
  'support',
  'conversation',
  'followup',
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function demoTutorialEnabled() {
  const flag = String(process.env.DEMO_TUTORIAL || '').toLowerCase().trim();
  if (!['1', 'true', 'yes'].includes(flag)) return false;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return false;
  const named = String(process.env.SIMPATICO_ENV || '').toLowerCase().trim();
  if (named === 'study' || getSimpaticoEnv() === 'study') return false;
  return isLocalEnv() || process.env.MEMORY_DB === 'true';
}

function profile(id, email, displayName, extra = {}) {
  const now = Date.now();
  return {
    id,
    email,
    password: extra.password || crypto.randomBytes(18).toString('hex'),
    display_name: displayName,
    photo_url: `https://api.dicebear.com/5.x/thumbs/svg?seed=${encodeURIComponent(displayName)}`,
    is_admin: false,
    is_support: false,
    email_verified: true,
    preferred_language: 'en',
    timezone: 'America/New_York',
    study_consent: true,
    contacts: [],
    chat_disabled: false,
    has_seen_match: false,
    match_notice_seen: null,
    simpatico_match: null,
    country: 'United States',
    residence: 'New York',
    birth_date: '1985-06-15',
    race: 'Prefer not to say',
    ethnicity: 'Not Hispanic or Latino',
    bio_sex: 'Prefer not to say',
    education: 'Prefer not to say',
    household: 'Prefer not to say',
    hobbies: 'reading',
    loss_date: '2020-03-01',
    kinship: 'Spouse',
    cause: 'Natural',
    deceased_age: '70',
    loss_exp: 'Fictional tutorial story. This person is not a study participant.',
    created_at: now,
    updated_at: now,
    ...extra,
    is_admin: false,
    is_support: false,
  };
}

export async function ensureDemoUsers() {
  if (!demoTutorialEnabled()) return null;
  const participant = profile(
    DEMO_PARTICIPANT_ID,
    'demo@local',
    'Casey Morgan',
    { password: DEMO_PASSWORD }
  );
  const partner = profile(
    DEMO_PARTNER_ID,
    'partner@local.example',
    'Jordan Hale'
  );
  const existingP = await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
  const existingM = await getItem(TABLES.USERS, { id: DEMO_PARTNER_ID });
  if (!existingP) await putItem(TABLES.USERS, participant);
  else if (existingP.is_admin || existingP.is_support) {
    await updateItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }, {
      is_admin: false,
      is_support: false,
      updated_at: Date.now(),
    });
  }
  if (!existingM) await putItem(TABLES.USERS, partner);
  return {
    participant: existingP || participant,
    partner: existingM || partner,
  };
}

async function deleteDemoChat() {
  const ids = new Set([DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID]);
  const convos = await scan(TABLES.CONVERSATIONS);
  const convoIds = new Set();
  for (const row of convos) {
    const users = Array.isArray(row?.users) ? row.users : [];
    if (!users.some((uid) => ids.has(uid))) continue;
    convoIds.add(row.id);
    await deleteItem(TABLES.CONVERSATIONS, { id: row.id });
  }
  const messages = await scan(TABLES.MESSAGES);
  for (const row of messages) {
    if (!convoIds.has(row?.conversation_id)) continue;
    await deleteItem(TABLES.MESSAGES, {
      conversation_id: row.conversation_id,
      message_id: row.message_id,
    });
  }
}

async function clearMatch() {
  const now = Date.now();
  for (const id of [DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID]) {
    const row = await getItem(TABLES.USERS, { id });
    if (!row) continue;
    await updateItem(TABLES.USERS, { id }, {
      simpatico_match: null,
      contacts: [],
      has_seen_match: false,
      match_notice_seen: null,
      chat_disabled: false,
      updated_at: now,
    });
  }
}

function matchFields(user) {
  return {
    uid: user.id,
    displayName: user.display_name,
    photoURL: user.photo_url || '',
  };
}

function matchContact(user) {
  return {
    ...matchFields(user),
    type: 'match',
    residence: user.residence || '',
    lossExp: user.loss_exp || '',
  };
}

async function applyMatch({ noticeSeen }) {
  const participant = await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
  const partner = await getItem(TABLES.USERS, { id: DEMO_PARTNER_ID });
  const now = Date.now();
  await updateItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }, {
    simpatico_match: matchFields(partner),
    contacts: [matchContact(partner)],
    has_seen_match: false,
    match_notice_seen: noticeSeen,
    updated_at: now,
  });
  await updateItem(TABLES.USERS, { id: DEMO_PARTNER_ID }, {
    simpatico_match: matchFields(participant),
    contacts: [matchContact(participant)],
    has_seen_match: true,
    match_notice_seen: true,
    updated_at: now,
  });
}

function convoId() {
  const [a, b] = [DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID].sort();
  return `${a}+${b}`;
}

async function writeConversation({ withFollowUp }) {
  await applyMatch({ noticeSeen: true });
  const now = Date.now();
  const id = convoId();
  const preview = 'Some days are just damn hard, and it helps to talk.';
  const startAt = withFollowUp
    ? now - (Number(WEEK8_TIME_POINT.offsetDays || 0) + 1) * DAY_MS
    : null;
  await putItem(TABLES.CONVERSATIONS, {
    id,
    users: [DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID].sort(),
    requester: DEMO_PARTICIPANT_ID,
    recipient: DEMO_PARTNER_ID,
    consent_by: [DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID],
    mutual_consent: true,
    is_closed: false,
    moderation_status: 'active',
    has_unread_by: [],
    last_msg_at: now,
    last_msg_preview: preview,
    last_sender_id: DEMO_PARTICIPANT_ID,
    intervention_start_at: startAt,
    created_at: now - 60 * 60 * 1000,
    updated_at: now,
  });
  const lines = [
    [DEMO_PARTNER_ID, 'Jordan Hale', 'Hello Casey. I am glad we matched. This is a practice conversation.', now - 20 * 60 * 1000],
    [DEMO_PARTICIPANT_ID, 'Casey Morgan', preview, now - 10 * 60 * 1000],
    [DEMO_PARTNER_ID, 'Jordan Hale', 'I am here to listen.', now],
  ];
  for (const [uid, name, body, at] of lines) {
    await putItem(TABLES.MESSAGES, {
      conversation_id: id,
      message_id: crypto.randomUUID(),
      body,
      sent_from_uid: uid,
      sent_from_display_name: name,
      status: 'sent',
      created_at: at,
    });
  }
  if (withFollowUp) {
    await assignFollowUpForUsers(
      [DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID],
      { interventionStartAt: startAt }
    );
  }
}

async function resetPair() {
  await ensureDemoUsers();
  await deleteDemoChat();
  await clearMatch();
}

async function wipeDemoParticipant() {
  await deleteDemoChat();
  await clearMatch();
  const rows = await scan(TABLES.ASSESSMENTS);
  for (const row of rows) {
    if (row?.user_id !== DEMO_PARTICIPANT_ID) continue;
    await deleteItem(TABLES.ASSESSMENTS, { id: row.id });
  }
  const user = await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
  if (user) await deleteItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
}

async function prepareWaiting() {
  await deleteDemoChat();
  await clearMatch();
}

async function applyMatchKeepAnswers() {
  await ensureDemoUsers();
  await deleteDemoChat();
  const participant = await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
  const partner = await getItem(TABLES.USERS, { id: DEMO_PARTNER_ID });
  const now = Date.now();
  await updateItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }, {
    simpatico_match: matchFields(partner),
    contacts: [matchContact(partner)],
    has_seen_match: false,
    match_notice_seen: false,
    is_admin: false,
    is_support: false,
    updated_at: now,
  });
  await updateItem(TABLES.USERS, { id: DEMO_PARTNER_ID }, {
    simpatico_match: matchFields(participant),
    contacts: [matchContact(participant)],
    has_seen_match: true,
    match_notice_seen: true,
    is_admin: false,
    is_support: false,
    updated_at: now,
  });
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

async function acceptDemoRequest() {
  await ensureDemoUsers();
  const id = convoId();
  const convo = await getItem(TABLES.CONVERSATIONS, { id });
  if (!convo) fail('Request a conversation with Jordan Hale first.');
  if (!convo.mutual_consent) {
    const consentBy = Array.isArray(convo.consent_by) ? [...convo.consent_by] : [];
    if (!consentBy.includes(DEMO_PARTNER_ID)) consentBy.push(DEMO_PARTNER_ID);
    const now = Date.now();
    await updateItem(TABLES.CONVERSATIONS, { id }, {
      consent_by: consentBy,
      mutual_consent: true,
      updated_at: now,
    });
    const updated = { ...convo, consent_by: consentBy, mutual_consent: true, updated_at: now };
    try {
      await broadcastToUsers([DEMO_PARTICIPANT_ID], {
        type: 'conversationAccepted',
        payload: {
          conversation: {
            docID: id,
            cid: id,
            users: updated.users,
            mutualConsent: true,
          },
          acceptedBy: { uid: DEMO_PARTNER_ID, displayName: 'Jordan Hale' },
          timestamp: now,
        },
      });
    } catch (err) {
      console.warn('[demo] accept notice failed:', err?.message || err);
    }
  }
}

const DEMO_REPLY = 'Some days are just damn hard, and it helps to talk.';

async function sendDemoReply() {
  const id = convoId();
  const convo = await getItem(TABLES.CONVERSATIONS, { id });
  if (!convo?.mutual_consent) fail('Accept the conversation before sending the partner reply.');
  const now = Date.now();
  const messageId = crypto.randomUUID();
  await putItem(TABLES.MESSAGES, {
    conversation_id: id,
    message_id: messageId,
    body: DEMO_REPLY,
    sent_from_uid: DEMO_PARTNER_ID,
    sent_from_display_name: 'Jordan Hale',
    status: 'sent',
    created_at: now,
  });
  const unread = new Set(Array.isArray(convo.has_unread_by) ? convo.has_unread_by : []);
  unread.add(DEMO_PARTICIPANT_ID);
  await updateItem(TABLES.CONVERSATIONS, { id }, {
    last_msg_at: now,
    last_msg_preview: DEMO_REPLY,
    last_sender_id: DEMO_PARTNER_ID,
    has_unread_by: [...unread],
    updated_at: now,
  });
  try {
    await broadcastToUsers([DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID], {
      type: 'message',
      payload: {
        conversationId: id,
        message: {
          id: messageId,
          mid: messageId,
          body: DEMO_REPLY,
          sentFromUid: DEMO_PARTNER_ID,
          sentFromDisplayName: 'Jordan Hale',
          status: 'sent',
          createdAt: { seconds: Math.floor(now / 1000) },
        },
      },
    });
  } catch (err) {
    console.warn('[demo] reply notice failed:', err?.message || err);
  }
}

async function seedDemoSupport() {
  const participant = await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
  if (!participant) fail('Create the demo account first.');
  const supportUid = config.supportUid;
  const id = [DEMO_PARTICIPANT_ID, supportUid].sort().join('+');
  const now = Date.now();
  const existing = await getItem(TABLES.CONVERSATIONS, { id });
  if (!existing) {
    await putItem(TABLES.CONVERSATIONS, {
      id,
      users: [DEMO_PARTICIPANT_ID, supportUid].sort(),
      requester: DEMO_PARTICIPANT_ID,
      recipient: supportUid,
      consent_by: [DEMO_PARTICIPANT_ID, supportUid],
      mutual_consent: true,
      is_closed: false,
      moderation_status: 'active',
      has_unread_by: [DEMO_PARTICIPANT_ID],
      last_msg_at: now,
      last_msg_preview: 'You can write to us here if you need help with the study.',
      last_sender_id: supportUid,
      intervention_start_at: null,
      created_at: now - 30 * 60 * 1000,
      updated_at: now,
    });
  }
  const messages = await scan(TABLES.MESSAGES);
  const hasSupportMsg = messages.some((row) => row?.conversation_id === id);
  if (!hasSupportMsg) {
    const lines = [
      [now - 20 * 60 * 1000, 'Hello Casey. This is Study Support. This is a practice message for the tutorial.'],
      [now, 'You can write to us here if you need help with the study.'],
    ];
    for (const [at, body] of lines) {
      await putItem(TABLES.MESSAGES, {
        conversation_id: id,
        message_id: crypto.randomUUID(),
        body,
        sent_from_uid: supportUid,
        sent_from_display_name: 'Study Support',
        status: 'sent',
        created_at: at,
      });
    }
  }
  const contacts = Array.isArray(participant.contacts) ? [...participant.contacts] : [];
  if (!contacts.some((c) => c?.uid === supportUid || c?.type === 'support')) {
    contacts.unshift({
      uid: supportUid,
      displayName: 'Study Support',
      type: 'support',
      photoURL: '',
    });
    await updateItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }, {
      contacts,
      updated_at: now,
    });
  }
}

async function openFollowUpWindow() {
  const id = convoId();
  const convo = await getItem(TABLES.CONVERSATIONS, { id });
  if (!convo?.mutual_consent) fail('Accept the conversation before opening follow-up assessments.');
  const startAt = Date.now() - (Number(WEEK8_TIME_POINT.offsetDays || 0) + 1) * DAY_MS;
  const dueAt = dueAtForOffset(startAt, WEEK8_TIME_POINT.offsetDays);
  const now = Date.now();
  await updateItem(TABLES.CONVERSATIONS, { id }, {
    intervention_start_at: startAt,
    updated_at: now,
  });
  await assignFollowUpForUsers(
    [DEMO_PARTICIPANT_ID, DEMO_PARTNER_ID],
    { interventionStartAt: startAt }
  );
  const rows = await scan(TABLES.ASSESSMENTS);
  for (const row of rows) {
    if (row?.user_id !== DEMO_PARTICIPANT_ID && row?.user_id !== DEMO_PARTNER_ID) continue;
    if (row.time_point !== WEEK8_TIME_POINT.id) continue;
    if (Number(row.due_at || 0) <= now) continue;
    await updateItem(TABLES.ASSESSMENTS, { id: row.id }, {
      due_at: dueAt,
      updated_at: now,
    });
  }
}

function stagePayload(name, participant) {
  return {
    ok: true,
    state: name,
    login: { username: DEMO_LOGIN, password: DEMO_PASSWORD },
    participant: participant
      ? {
        uid: participant.id,
        displayName: participant.display_name,
        admin: false,
      }
      : null,
    partner: { displayName: 'Jordan Hale' },
    states: DEMO_STATES,
  };
}

export async function setDemoState(state) {
  if (!demoTutorialEnabled()) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  const name = String(state || '').trim();
  if (!DEMO_STATES.includes(name)) {
    const err = new Error(`state must be one of: ${DEMO_STATES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (name === 'account') {
    await wipeDemoParticipant();
    return stagePayload(name, null);
  }
  if (name === 'accept') {
    await acceptDemoRequest();
    return stagePayload(name, await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }));
  }
  if (name === 'reply') {
    await sendDemoReply();
    return stagePayload(name, await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }));
  }
  if (name === 'support') {
    await seedDemoSupport();
    return stagePayload(name, await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }));
  }

  const existing = await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID });
  if (existing && (name === 'seed-answers' || name === 'waiting' || name === 'baseline-complete')) {
    await prepareWaiting();
    return stagePayload(name, await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }));
  }
  if (existing && name === 'matched') {
    await applyMatchKeepAnswers();
    return stagePayload(name, await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }));
  }
  if (name === 'followup') {
    const convo = await getItem(TABLES.CONVERSATIONS, { id: convoId() });
    if (convo?.mutual_consent) {
      await openFollowUpWindow();
      return stagePayload(name, existing || await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }));
    }
  }

  await resetPair();
  if (name === 'matched') {
    await applyMatch({ noticeSeen: false });
  } else if (name === 'conversation') {
    await writeConversation({ withFollowUp: false });
  } else if (name === 'followup') {
    await writeConversation({ withFollowUp: true });
  }
  return stagePayload(name, await getItem(TABLES.USERS, { id: DEMO_PARTICIPANT_ID }));
}

export function demoTutorialHelp() {
  return {
    ok: true,
    enabled: true,
    login: { username: DEMO_LOGIN, password: DEMO_PASSWORD },
    states: DEMO_STATES,
    hint: 'POST /api/dev/tutorial with {"state":"<name>"}. Register as demo / demo after state "account".',
    steps: [
      'account',
      'seed-answers',
      'waiting',
      'matched',
      'accept',
      'reply',
      'support',
      'followup',
    ],
  };
}
