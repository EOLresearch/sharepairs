/**
 * Transactional email helper. Uses SES when SES_FROM_EMAIL is set;
 * otherwise logs (stub/dev) so local flows still work.
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});
const FROM = process.env.SES_FROM_EMAIL || '';

/**
 * @returns {{ sent: boolean, mode: 'ses' | 'log' }}
 */
export async function sendVerificationEmail(toEmail, code) {
  const subject = 'Verify your Share Pairs email';
  const text = `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`;
  const html = `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`;

  if (!FROM) {
    console.log(`[email:log] To=${toEmail} Subject=${subject} Code=${code}`);
    return { sent: false, mode: 'log' };
  }

  await ses.send(
    new SendEmailCommand({
      Source: FROM,
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
  return { sent: true, mode: 'ses' };
}
