import { processAssessmentReminders } from '../../shared/assessments/service.js';

/**
 * Assessment reminder worker (EventBridge / local interval).
 * Scans due/overdue incomplete assignments and emails participants.
 */
export async function handler() {
  const result = await processAssessmentReminders();
  console.log('[assessments] reminders', result);
  return result;
}
