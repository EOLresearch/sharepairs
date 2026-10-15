/**
 * Transactional email helper. Study mail is sent from the study support inbox.
 * Local runs without SES_FROM_EMAIL only log, so tests do not send.
 *
 * Never throws — registration must not leave orphan users if SES fails.
 * Callers should surface `devCode` when `sent` is false.
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

/** Approved study sender. Used on the study site when SES_FROM_EMAIL is unset. */
export const STUDY_FROM_EMAIL = 'eolstudysupport@med.cornell.edu';

export function getFromEmail() {
  const configured = String(process.env.SES_FROM_EMAIL || process.env.SES_SENDER_EMAIL || '').trim();
  if (configured) return configured;
  const onStudy = String(process.env.SIMPATICO_ENV || '').toLowerCase() === 'study'
    || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  return onStudy ? STUDY_FROM_EMAIL : '';
}

const APP_URL =
  process.env.STUDY_APP_URL ||
  process.env.CORS_ORIGIN ||
  'https://d63lgf5y8mx7j.cloudfront.net';

export async function sendMail(toEmail, subject, text, html) {
  const from = getFromEmail();
  if (!toEmail) return { sent: false, mode: 'skip' };
  if (!from) {
    console.log(`[email:log] To=${toEmail} Subject=${subject}\n${text}`);
    return { sent: false, mode: 'log' };
  }
  try {
    await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Text: { Data: text },
            Html: { Data: html },
          },
        },
      })
    );
    console.log(`[email:ses] Sent to ${toEmail} from ${from} subject=${subject}`);
    return { sent: true, mode: 'ses' };
  } catch (err) {
    const message = err?.message || String(err);
    console.error(`[email:ses] FAILED To=${toEmail} From=${from}:`, err?.name, message);
    console.log(`[email:log] To=${toEmail} Subject=${subject}\n${text}`);
    return { sent: false, mode: 'ses-error', error: message };
  }
}

/**
 * @returns {{ sent: boolean, mode: 'ses' | 'log' | 'ses-error', error?: string }}
 */
export async function sendVerificationEmail(toEmail, code) {
  const subject = 'Verify your Share Pairs email';
  const text = `Your Share Pairs verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not create an account, you can ignore this email.`;
  const html = `<p>Your Share Pairs verification code is: <strong style="font-size:1.25em;letter-spacing:0.1em">${code}</strong></p><p>This code expires in 15 minutes.</p><p style="color:#666;font-size:0.9em">If you did not create an account, you can ignore this email.</p>`;
  return sendMail(toEmail, subject, text, html);
}

/**
 * Notify a participant that they have been matched.
 * partnerLabel is the other person's display name (optional).
 */
export async function sendMatchNotificationEmail(toEmail, { partnerLabel, recipientName } = {}) {
  const name = recipientName || 'there';
  const partner = partnerLabel || 'another participant';
  const subject = "You've got a Simpatico Match on Share Pairs";
  const text = [
    `Hi ${name},`,
    '',
    `You've been paired with ${partner} as a Simpatico Match in the Share Pairs study.`,
    '',
    'When you log in, your Simpatico Match will appear in Contacts. You can request a conversation when you are ready.',
    '',
    `Open the app: ${APP_URL}`,
    '',
    'If you have questions, message Study Support from inside the app.',
  ].join('\n');
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>You've been paired with <strong>${escapeHtml(partner)}</strong> as a Simpatico Match in the Share Pairs study.</p>
    <p>When you log in, your Simpatico Match will appear in <strong>Contacts</strong>. You can request a conversation when you are ready.</p>
    <p><a href="${escapeHtml(APP_URL)}">Open Share Pairs</a></p>
    <p style="color:#666;font-size:0.9em">If you have questions, message Study Support from inside the app.</p>
  `;
  return sendMail(toEmail, subject, text, html);
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
