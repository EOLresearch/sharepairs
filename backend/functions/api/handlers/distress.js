/**
 * POST /api/distress — participant Distress Thermometer submission.
 * Any authenticated user (not admin-only).
 */
import { authenticateUser } from '../../../shared/auth.js';
import { success, error } from '../../../shared/response.js';
import { validate, schemas } from '../../../shared/validation.js';
import { isHighDistress, processDistressSubmission } from '../../../shared/distressSafety.js';

export async function submitDistress(event) {
  try {
    const user = await authenticateUser(event);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON in request body', 400);
    }

    const validated = validate(schemas.distressSubmit, body);
    const { score, message, context } = validated;

    const result = await processDistressSubmission({
      userId: user.userId,
      score,
      message: message || null,
      context: context || null,
    });

    const high = isHighDistress(score);
    let responseMessage = 'Distress score recorded';
    if (high && result.notifyFailed) {
      responseMessage =
        'Distress score recorded and chat suspended, but the study-team notification failed';
    } else if (high) {
      responseMessage = 'Distress alert submitted and study team notified';
    }

    return success({
      eventId: result.eventId,
      score: result.score,
      status: result.status,
      chatDisabled: result.chatDisabled,
      notified: result.notified,
      notifyFailed: !!result.notifyFailed,
      notifyError: result.notifyError || null,
      message: responseMessage,
    });
  } catch (err) {
    console.error('Error submitting distress alert:', err);

    if (err.message?.includes('Authentication failed') || err.message?.includes('Missing')) {
      return error(err.message, 401);
    }
    if (err.message?.includes('Validation error') || err.status === 400) {
      return error(err.message, 400);
    }
    return error('Internal server error', 500);
  }
}
