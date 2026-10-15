/**
 * Distress Thermometer safety workflow.
 * Persist every score. On score >= threshold: suspend chat, then notify the study team.
 * Notification failure must not undo persist or chat suspension.
 */
import crypto from 'crypto';
import { putItem, query, scan, updateItem } from './database.js';
import { TABLES } from './database.js';
import { auditEvents } from './audit.js';
import { sendMail, escapeHtml } from './email.js';
import { getStudyTeamEmail } from './studyNotify.js';

export const DISTRESS_THRESHOLD = parseInt(process.env.DISTRESS_THRESHOLD || '70', 10);
const RATE_LIMIT_MINUTES = parseInt(process.env.DISTRESS_RATE_LIMIT_MINUTES || '15', 10);

export function isHighDistress(score) {
  return Number(score) >= DISTRESS_THRESHOLD;
}

/** Local log delivery counts as notified; SES errors do not. */
export function notificationSucceeded(result) {
  if (!result) return false;
  if (result.sent === true) return true;
  return result.mode === 'log';
}

async function listUserDistressEvents(userId) {
  try {
    return await query(TABLES.DISTRESS_EVENTS, {
      IndexName: 'user-index',
      KeyConditionExpression: 'user_id = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    });
  } catch {
    const all = await scan(TABLES.DISTRESS_EVENTS);
    return all.filter((e) => e.user_id === userId || e.userId === userId);
  }
}

async function recentlyNotifiedHighDistress(userId, exceptId) {
  const windowStart = Date.now() - RATE_LIMIT_MINUTES * 60 * 1000;
  const events = await listUserDistressEvents(userId);
  return events.some(
    (e) =>
      e.id !== exceptId &&
      Number(e.score) >= DISTRESS_THRESHOLD &&
      Number(e.created_at || 0) > windowStart &&
      (e.status === 'sent' || e.notified === true)
  );
}

export async function sendDistressStudyEmail({
  userId,
  score,
  eventId,
  timestamp,
  message,
} = {}) {
  const to = getStudyTeamEmail();
  const when = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const subject = `[Share Pairs] Distress alert — score ${score}`;
  const text = [
    'A participant submitted a high Distress Thermometer score.',
    '',
    `Score: ${score} / 100 (threshold ${DISTRESS_THRESHOLD})`,
    `User ID: ${userId}`,
    `Event ID: ${eventId}`,
    `Timestamp: ${when}`,
    message ? `Message: ${message}` : '',
    '',
    'Chat has been suspended for this participant. Existing messages were not deleted.',
    'Open Admin Dashboard → Users to review and re-enable chat when appropriate.',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const html = `
    <p>A participant submitted a high Distress Thermometer score.</p>
    <p><strong>Score:</strong> ${escapeHtml(String(score))} / 100 (threshold ${DISTRESS_THRESHOLD})<br/>
    <strong>User ID:</strong> <code>${escapeHtml(String(userId || ''))}</code><br/>
    <strong>Event ID:</strong> <code>${escapeHtml(String(eventId || ''))}</code><br/>
    <strong>Timestamp:</strong> ${escapeHtml(when)}</p>
    ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
    <p>Chat has been suspended for this participant. Existing messages were not deleted.</p>
    <p>Open Admin Dashboard → Users to review and re-enable chat when appropriate.</p>
  `;
  return sendMail(to, subject, text, html);
}

/**
 * Persist a thermometer score and apply high-score safety actions.
 * @param {{ userId: string, score: number, message?: string, context?: object, notify?: Function }} args
 */
export async function processDistressSubmission({
  userId,
  score,
  message = null,
  context = null,
  notify = sendDistressStudyEmail,
} = {}) {
  if (!userId) throw new Error('userId required');
  const nScore = Number(score);
  if (!Number.isInteger(nScore) || nScore < 0 || nScore > 100) {
    const err = new Error('Score must be an integer between 0 and 100');
    err.status = 400;
    throw err;
  }

  const high = isHighDistress(nScore);
  const timestamp = Date.now();
  const eventId = crypto.randomUUID();

  const distressEvent = {
    id: eventId,
    user_id: userId,
    score: nScore,
    message: message || null,
    context: context || null,
    status: high ? 'pending_notify' : 'recorded',
    chat_suspended: false,
    notified: false,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await putItem(TABLES.DISTRESS_EVENTS, distressEvent);
  await auditEvents.distressSubmitted(userId, eventId, nScore, high);

  if (!high) {
    return {
      eventId,
      score: nScore,
      status: 'recorded',
      chatDisabled: false,
      notified: false,
      notifyFailed: false,
    };
  }

  try {
    await updateItem(TABLES.USERS, { id: userId }, {
      chat_disabled: true,
      updated_at: Date.now(),
    });
  } catch (err) {
    await updateItem(TABLES.DISTRESS_EVENTS, { id: eventId }, {
      status: 'suspend_failed',
      suspend_error: err.message || String(err),
      updated_at: Date.now(),
    });
    throw err;
  }

  await updateItem(TABLES.DISTRESS_EVENTS, { id: eventId }, {
    chat_suspended: true,
    updated_at: Date.now(),
  });

  let skipEmail = false;
  try {
    skipEmail = await recentlyNotifiedHighDistress(userId, eventId);
  } catch (err) {
    console.warn('[distress] rate-limit lookup failed, sending anyway:', err?.message || err);
  }

  if (skipEmail) {
    await updateItem(TABLES.DISTRESS_EVENTS, { id: eventId }, {
      status: 'sent',
      notified: true,
      notify_skipped: true,
      updated_at: Date.now(),
    });
    return {
      eventId,
      score: nScore,
      status: 'sent',
      chatDisabled: true,
      notified: true,
      notifyFailed: false,
      notifySkipped: true,
    };
  }

  let notifyResult;
  try {
    notifyResult = await notify({
      userId,
      score: nScore,
      eventId,
      timestamp,
      message,
      context,
    });
  } catch (err) {
    notifyResult = { sent: false, mode: 'error', error: err.message || String(err) };
  }

  if (notificationSucceeded(notifyResult)) {
    await updateItem(TABLES.DISTRESS_EVENTS, { id: eventId }, {
      status: 'sent',
      notified: true,
      emailed_at: Date.now(),
      notify_mode: notifyResult.mode || null,
      updated_at: Date.now(),
    });
    await auditEvents.distressEmailSent(userId, eventId, notifyResult.mode || 'sent');
    return {
      eventId,
      score: nScore,
      status: 'sent',
      chatDisabled: true,
      notified: true,
      notifyFailed: false,
    };
  }

  const notifyError =
    notifyResult?.error || `Distress notification failed (${notifyResult?.mode || 'unknown'})`;
  await updateItem(TABLES.DISTRESS_EVENTS, { id: eventId }, {
    status: 'notify_failed',
    notified: false,
    notify_error: notifyError,
    notify_mode: notifyResult?.mode || null,
    updated_at: Date.now(),
  });
  await auditEvents.distressNotifyFailed(userId, eventId, notifyError);

  return {
    eventId,
    score: nScore,
    status: 'notify_failed',
    chatDisabled: true,
    notified: false,
    notifyFailed: true,
    notifyError,
  };
}
