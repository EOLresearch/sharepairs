/**
 * Configurable assessment time points and due-state helpers.
 * Schedule is stored as a single assessments-table row (id = schedule:global).
 */
import { getItem, putItem, TABLES } from '../database.js';

export const SCHEDULE_ID = 'schedule:global';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Week-8 is assigned from intervention_start_at, not this list.
 * Baseline is no longer a default time point. A stored schedule row is left as-is.
 */
export const DEFAULT_TIME_POINTS = [];

/** After due_at, stay "due" for this many days before becoming overdue. */
export const DUE_GRACE_DAYS = Number(process.env.ASSESSMENT_DUE_GRACE_DAYS || 7);

/** Minimum gap between reminder emails for the same assignment. */
export const REMINDER_INTERVAL_DAYS = Number(process.env.ASSESSMENT_REMINDER_DAYS || 3);

export async function getSchedule() {
  const row = await getItem(TABLES.ASSESSMENTS, { id: SCHEDULE_ID });
  const timePoints = Array.isArray(row?.time_points) && row.time_points.length
    ? row.time_points
    : DEFAULT_TIME_POINTS;
  return {
    id: SCHEDULE_ID,
    timePoints,
    dueGraceDays: Number(row?.due_grace_days || DUE_GRACE_DAYS),
    reminderIntervalDays: Number(row?.reminder_interval_days || REMINDER_INTERVAL_DAYS),
    updatedAt: row?.updated_at || null,
  };
}

export async function saveSchedule({ timePoints, dueGraceDays, reminderIntervalDays }) {
  const current = await getSchedule();
  const next = {
    id: SCHEDULE_ID,
    type: 'schedule',
    time_points: Array.isArray(timePoints) ? timePoints : current.timePoints,
    due_grace_days: dueGraceDays != null ? Number(dueGraceDays) : current.dueGraceDays,
    reminder_interval_days:
      reminderIntervalDays != null ? Number(reminderIntervalDays) : current.reminderIntervalDays,
    updated_at: Date.now(),
  };
  await putItem(TABLES.ASSESSMENTS, next);
  return getSchedule();
}

export function computeAssignmentStatus(row, now = Date.now(), graceDays = DUE_GRACE_DAYS) {
  if (row?.status === 'complete' || row?.completed_at) return 'complete';
  const due = Number(row?.due_at || 0);
  if (!due || now < due) return 'upcoming';
  const grace = Number.isFinite(Number(graceDays)) ? Number(graceDays) : DUE_GRACE_DAYS;
  if (now >= due + grace * DAY_MS) return 'overdue';
  return 'due';
}

export function assignmentIsActionable(status) {
  return status === 'due' || status === 'overdue';
}

export function dueAtForOffset(anchorMs, offsetDays) {
  return Number(anchorMs) + Number(offsetDays || 0) * DAY_MS;
}
