import { getItem, updateItem } from '../../shared/database.js';
import { TABLES } from '../../shared/database.js';
import { auditEvents } from '../../shared/audit.js';
import { sendMail } from '../../shared/email.js';
import { getStudyTeamEmail } from '../../shared/studyNotify.js';
import { notificationSucceeded } from '../../shared/distressSafety.js';

/**
 * Worker Lambda - Processes distress alerts from SQS and sends emails via SES
 * Triggered by SQS queue: sharepairs-dev-distress-alerts
 */
export const handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    try {
      // Parse SQS message
      const messageBody = JSON.parse(record.body);
      const { eventId, userId, score, timestamp, message, context } = messageBody;

      // Get distress event from database (idempotency check)
      const distressEvent = await getItem(TABLES.DISTRESS_EVENTS, { id: eventId });

      if (!distressEvent) {
        console.error(`Distress event not found: ${eventId}`);
        results.push({ eventId, status: 'failed', error: 'Event not found' });
        continue;
      }

      // Idempotency: Check if already sent
      if (distressEvent.status === 'sent' && distressEvent.emailed_at) {
        console.log(`Event ${eventId} already processed, skipping`);
        results.push({ eventId, status: 'skipped', reason: 'already_sent' });
        continue;
      }

      // Get user profile for email content
      // Note: Users and user_profiles tables will be created in future tasks
      // For now, use distress event data and minimal user lookup
      let user = null;
      let userProfile = null;
      
      try {
        user = await getItem(TABLES.USERS, { id: userId });
        if (user) {
          userProfile = await getItem(TABLES.USER_PROFILES, { id: userId }).catch(() => null);
        }
      } catch (err) {
        console.warn(`Could not fetch user ${userId}, using event data only:`, err.message);
        // Continue with event data only
      }

      // Build email content
      const emailSubject = `🚨 Distress Alert - Share Pairs (Score: ${score})`;
      const emailBody = buildEmailBody(user, userProfile, distressEvent, message, context, userId);

      const emailResponse = await sendMail(
        getStudyTeamEmail(),
        emailSubject,
        emailBody.replace(/<[^>]*>/g, ''),
        emailBody
      );
      const messageId = emailResponse.mode || 'sent';

      if (!notificationSucceeded(emailResponse)) {
        await updateItem(TABLES.DISTRESS_EVENTS, { id: eventId }, {
          status: 'notify_failed',
          notified: false,
          notify_error: emailResponse.error || `Distress notification failed (${emailResponse.mode})`,
          notify_mode: emailResponse.mode || null,
          updated_at: Date.now(),
        });
        await auditEvents.distressNotifyFailed(
          userId,
          eventId,
          emailResponse.error || emailResponse.mode
        );
        results.push({ eventId, status: 'failed', error: emailResponse.error || emailResponse.mode });
        continue;
      }

      await updateItem(TABLES.DISTRESS_EVENTS, { id: eventId }, {
        status: 'sent',
        notified: true,
        emailed_at: Date.now(),
        email_message_id: messageId,
        notify_mode: emailResponse.mode || null,
        updated_at: Date.now(),
      });

      await auditEvents.distressEmailSent(userId, eventId, messageId);

      results.push({ eventId, status: 'success', messageId });
    } catch (err) {
      console.error('Error processing distress alert:', err);
      const eventId = JSON.parse(record.body)?.eventId || 'unknown';
      results.push({ eventId, status: 'failed', error: err.message });
      // Don't throw - let SQS handle retries via DLQ
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: results.length, results })
  };
};

/**
 * Build human-readable email body for distress alert
 */
function buildEmailBody(user, userProfile, distressEvent, message, context, userId) {
  const timestamp = new Date(distressEvent.created_at).toISOString();
  const displayName = userProfile?.display_name || user?.display_name || user?.email || 'Unknown User';
  const userEmail = user?.email || 'Email not available';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .info-box { background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        .score { font-size: 24px; font-weight: bold; color: #e74c3c; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚨 Distress Alert - Share Pairs</h1>
      </div>
      <div class="content">
        <div class="alert-box">
          <h2>High Distress Score Detected</h2>
          <p class="score">Score: ${distressEvent.score} / 100</p>
          <p><strong>Threshold:</strong> ${process.env.DISTRESS_THRESHOLD || 70}</p>
        </div>

        <div class="info-box">
          <h3>User Information</h3>
          <p><strong>User ID:</strong> ${userId}</p>
          <p><strong>Display Name:</strong> ${displayName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
        </div>

        ${message ? `
        <div class="info-box">
          <h3>User Message</h3>
          <p>${message.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}

        ${context ? `
        <div class="info-box">
          <h3>Additional Context</h3>
          <pre>${JSON.stringify(context, null, 2)}</pre>
        </div>
        ` : ''}

        <div class="info-box">
          <h3>Event Details</h3>
          <p><strong>Event ID:</strong> ${distressEvent.id}</p>
          <p><strong>Status:</strong> ${distressEvent.status}</p>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated alert from Share Pairs. Please follow up with the user as appropriate.</p>
        <p>For IRB compliance, all distress alerts are logged in the audit system.</p>
      </div>
    </body>
    </html>
  `;
}

