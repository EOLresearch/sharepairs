/**
 * Study-team email helpers. Destination is env-configurable (no hardcoded secrets).
 */
import { sendMail, escapeHtml } from './email.js';

export function getStudyTeamEmail() {
  return (
    process.env.STUDY_TEAM_EMAIL ||
    process.env.STUDY_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    'eolstudysupport@med.cornell.edu'
  );
}

export async function sendFlaggedConversationEmail({
  conversationId,
  reason,
  priority = 'high',
  reporterLabel,
  explanation,
  messagePreview,
  participantLabels = [],
} = {}) {
  const to = getStudyTeamEmail();
  const pri = String(priority || 'high').toUpperCase();
  const subject = `[Share Pairs] ${pri} — conversation flagged for review`;
  const people = participantLabels.filter(Boolean).join(' ↔ ') || 'participants';
  const text = [
    `A conversation was flagged for study-team review.`,
    '',
    `Priority: ${pri}`,
    `Reason: ${reason || 'flagged'}`,
    `Conversation: ${conversationId || '—'}`,
    `Participants: ${people}`,
    reporterLabel ? `Reported by: ${reporterLabel}` : '',
    explanation ? `Explanation: ${explanation}` : '',
    messagePreview ? `Message: ${messagePreview}` : '',
    '',
    'This does not automatically pause or terminate the match.',
    'Open the Admin Dashboard → Conversations to review.',
  ]
    .filter((line) => line !== '')
    .join('\n');
  const html = `
    <p>A conversation was flagged for study-team review.</p>
    <p><strong>Priority:</strong> ${escapeHtml(pri)}<br/>
    <strong>Reason:</strong> ${escapeHtml(reason || 'flagged')}<br/>
    <strong>Conversation:</strong> <code>${escapeHtml(conversationId || '—')}</code><br/>
    <strong>Participants:</strong> ${escapeHtml(people)}</p>
    ${reporterLabel ? `<p><strong>Reported by:</strong> ${escapeHtml(reporterLabel)}</p>` : ''}
    ${explanation ? `<p><strong>Explanation:</strong> ${escapeHtml(explanation)}</p>` : ''}
    ${messagePreview ? `<p><strong>Message:</strong> ${escapeHtml(messagePreview)}</p>` : ''}
    <p>This does not automatically pause or terminate the match.</p>
    <p>Open the Admin Dashboard → Conversations to review.</p>
  `;
  return sendMail(to, subject, text, html);
}

export async function sendAssessmentReminderEmail(toEmail, { recipientName, instrumentTitle, timePointLabel, dueLabel } = {}) {
  const name = recipientName || 'there';
  const title = instrumentTitle || 'a study assessment';
  const subject = `Reminder: ${title} is due on Share Pairs`;
  const text = [
    `Hi ${name},`,
    '',
    `This is a reminder that ${title}${timePointLabel ? ` (${timePointLabel})` : ''} is ${dueLabel || 'due'}.`,
    '',
    'Please log in to Share Pairs to complete it when you can.',
    '',
    'If you have questions, message Study Support from inside the app.',
  ].join('\n');
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>This is a reminder that <strong>${escapeHtml(title)}</strong>${
      timePointLabel ? ` (${escapeHtml(timePointLabel)})` : ''
    } is ${escapeHtml(dueLabel || 'due')}.</p>
    <p>Please log in to Share Pairs to complete it when you can.</p>
    <p style="color:#666;font-size:0.9em">If you have questions, message Study Support from inside the app.</p>
  `;
  return sendMail(toEmail, subject, text, html);
}
