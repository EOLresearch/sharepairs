import { getItem, putItem, scan, updateItem, TABLES } from '../database.js';
import {
  getInstrument,
  instrumentIsCompletable,
  matchingRequiredInstrumentIds,
  BASELINE_INSTRUMENT_IDS,
  BASELINE_TIME_POINT,
  isBaselineTimePoint,
  WEEK8_TIME_POINT,
  CSSRS_SCREENING,
  CSSRS_SCREENING_TIME_POINT,
  CSSRS_INTAKE,
  INTAKE_TIME_POINT,
  isWeek8TimePoint,
} from './instruments.js';
import {
  profileToAssessmentResponses,
  mergeMissingResponses,
  profileUpdatesFromAssessment,
  assessmentKeysAffectedByProfile,
} from './prefill.js';
import {
  getSchedule,
  computeAssignmentStatus,
  assignmentIsActionable,
  dueAtForOffset,
  SCHEDULE_ID,
} from './schedule.js';
import { submitToRedcap, redcapExportEnabled, redcapUnconfiguredReason } from './redcap.js';
import { sendAssessmentReminderEmail } from '../studyNotify.js';

export function assignmentKey(userId, instrumentId, timePoint) {
  return `asg:${userId}:${instrumentId}:${timePoint}`;
}

export function itemIsVisible(item, responses) {
  if (!item?.showIf) return true;
  return String(responses?.[item.showIf.id] ?? '') === String(item.showIf.equals);
}

function allowedChoiceValues(item) {
  return (Array.isArray(item?.options) ? item.options : []).map((o) => String(o.value));
}

function itemIdSet(def) {
  return new Set((def?.items || []).map((item) => item.id));
}

function initialResponsesForInstrument(instrumentId, user) {
  const def = getInstrument(instrumentId);
  if (!def || !user) return null;
  const merged = mergeMissingResponses({}, profileToAssessmentResponses(user), itemIdSet(def));
  return Object.keys(merged).length ? merged : null;
}

function fillOmittedSharedResponses(responses, user, def) {
  const prefill = profileToAssessmentResponses(user);
  const ids = itemIdSet(def);
  const next = { ...(responses || {}) };
  for (const [key, value] of Object.entries(prefill)) {
    if (!ids.has(key) || value == null || String(value).trim() === '') continue;
    if (!Object.prototype.hasOwnProperty.call(next, key)) next[key] = value;
  }
  return next;
}

/**
 * Copy the latest shared profile values onto incomplete questionnaires.
 * changedKeys limits the copy to fields just saved. Completed rows stay as submitted.
 */
export async function syncProfileIntoOpenAssessments(user, changedKeys) {
  if (!user?.id) return;
  const affected = changedKeys ? assessmentKeysAffectedByProfile(changedKeys) : null;
  if (affected && affected.size === 0) return;
  const prefill = profileToAssessmentResponses(user);
  const all = await scan(TABLES.ASSESSMENTS);
  for (const row of all) {
    if (!row || row.user_id !== user.id || row.type === 'schedule' || row.id === SCHEDULE_ID) continue;
    if (row.status === 'complete' || row.completed_at) continue;
    const def = getInstrument(row.instrument_id);
    if (!def?.items?.length) continue;
    const ids = itemIdSet(def);
    const responses = { ...(row.responses || {}) };
    let changed = false;
    const keys = affected || new Set(Object.keys(prefill));
    for (const key of keys) {
      if (!ids.has(key)) continue;
      const value = prefill[key] || '';
      if (!value) {
        if (responses[key]) {
          delete responses[key];
          changed = true;
        }
        continue;
      }
      if (responses[key] !== value) {
        responses[key] = value;
        changed = true;
      }
    }
    if (!changed) continue;
    await updateItem(TABLES.ASSESSMENTS, { id: row.id }, {
      responses: Object.keys(responses).length ? responses : null,
      updated_at: Date.now(),
    });
  }
}

async function syncAssessmentToProfile(uid, rawResponses) {
  const user = await getItem(TABLES.USERS, { id: uid });
  if (!user) return;
  const updates = profileUpdatesFromAssessment(user, rawResponses || {});
  const changedKeys = Object.keys(updates).filter((key) => String(user[key] || '') !== String(updates[key] || ''));
  if (!changedKeys.length) return;
  updates.updated_at = Date.now();
  await updateItem(TABLES.USERS, { id: uid }, updates);
  await syncProfileIntoOpenAssessments({ ...user, ...updates }, changedKeys);
}

function exportPayload(row, def, responses) {
  return {
    instrumentId: def?.id || row.instrument_id,
    redcapForm: def?.redcapForm,
    recordId: row.user_id,
    timePoint: row.time_point,
    responses,
  };
}

async function persistExportStatus(id, status, error = null) {
  const now = Date.now();
  await updateItem(TABLES.ASSESSMENTS, { id }, {
    redcap_export_status: status,
    redcap_export_at: now,
    redcap_export_error: error,
    updated_at: now,
  });
}

async function runRedcapExport(id, row, def, responses) {
  if (!redcapExportEnabled()) {
    const error = redcapUnconfiguredReason();
    await persistExportStatus(id, 'unconfigured', error);
    console.warn('[redcap] export skipped', { assignmentId: id, reason: error });
    return { status: 'unconfigured', error };
  }

  const result = await submitToRedcap(exportPayload(row, def, responses));
  if (result.submitted) {
    await persistExportStatus(id, 'sent', null);
    return { status: 'sent', error: null };
  }
  const error = result.error || 'export_failed';
  await persistExportStatus(id, 'failed', error);
  console.error('[redcap] export failed', { assignmentId: id, reason: error });
  return { status: 'failed', error };
}

export function toAssignmentShape(row, schedule) {
  if (!row || row.type === 'schedule' || row.id === SCHEDULE_ID) return null;
  const def = getInstrument(row.instrument_id);
  const status = computeAssignmentStatus(row, Date.now(), schedule?.dueGraceDays);
  const held = Boolean(def?.scalePending || def?.contentPending || !def?.items?.length);
  return {
    id: row.id,
    uid: row.user_id,
    instrumentId: row.instrument_id,
    instrumentTitle: def?.title || row.instrument_id,
    timePoint: row.time_point,
    timePointLabel: row.time_point_label || row.time_point,
    dueAt: row.due_at,
    status,
    held,
    heldReason: def?.scaleIssue || null,
    completedAt: row.completed_at || null,
    lastRemindedAt: row.last_reminded_at || null,
    createdAt: row.created_at,
    redcapExportStatus: row.redcap_export_status || null,
    redcapExportAt: row.redcap_export_at || null,
    redcapExportError: row.redcap_export_error || null,
    staffOnly: Boolean(def?.staffOnly),
    enteredBy: row.entered_by || null,
    entrySource: row.entry_source || null,
    screenerReference: row.screener_reference || null,
  };
}

export async function listAssignments({ uid, includeResponses = false } = {}) {
  const schedule = await getSchedule();
  const all = await scan(TABLES.ASSESSMENTS);
  const rows = all.filter((row) => {
    if (!row || row.id === SCHEDULE_ID || row.type === 'schedule') return false;
    if (uid && row.user_id !== uid) return false;
    return true;
  });
  rows.sort((a, b) => Number(a.due_at || 0) - Number(b.due_at || 0));
  return rows.map((row) => {
    const shape = toAssignmentShape(row, schedule);
    if (includeResponses) shape.responses = row.responses || null;
    return shape;
  }).filter(Boolean);
}

async function createAssignmentIfMissing({
  uid,
  instrumentId,
  timePoint,
  timePointLabel,
  dueAt,
  user,
}) {
  if (!uid || !getInstrument(instrumentId)) return null;
  const id = assignmentKey(uid, instrumentId, timePoint);
  const existing = await getItem(TABLES.ASSESSMENTS, { id });
  if (existing) return null;
  const now = Date.now();
  const row = {
    id,
    type: 'assignment',
    user_id: uid,
    instrument_id: instrumentId,
    time_point: timePoint,
    time_point_label: timePointLabel || timePoint,
    due_at: dueAt,
    status: 'upcoming',
    responses: initialResponsesForInstrument(instrumentId, user),
    completed_at: null,
    last_reminded_at: null,
    redcap_export_status: null,
    redcap_export_at: null,
    redcap_export_error: null,
    created_at: now,
    updated_at: now,
  };
  await putItem(TABLES.ASSESSMENTS, row);
  return id;
}

export async function assignAssessmentsForUsers(userIds, { anchorMs = Date.now() } = {}) {
  const schedule = await getSchedule();
  const created = [];
  for (const uid of userIds) {
    if (!uid) continue;
    const user = await getItem(TABLES.USERS, { id: uid });
    for (const tp of schedule.timePoints) {
      if (isBaselineTimePoint(tp?.id)) continue;
      const instruments = Array.isArray(tp.instruments) ? tp.instruments : [];
      for (const instrumentId of instruments) {
        const id = await createAssignmentIfMissing({
          uid,
          instrumentId,
          timePoint: tp.id,
          timePointLabel: tp.label || tp.id,
          dueAt: dueAtForOffset(anchorMs, tp.offsetDays),
          user,
        });
        if (id) created.push(id);
      }
    }
  }
  return { created: created.length };
}

/**
 * Writes historical baseline assignment rows. Enrollment does not call this.
 * Existing rows are left in place.
 */
export async function assignBaselineForUsers(userIds, { anchorMs = Date.now(), user } = {}) {
  const tp = BASELINE_TIME_POINT;
  const created = [];
  for (const uid of userIds) {
    if (!uid) continue;
    const profile = user && user.id === uid ? user : await getItem(TABLES.USERS, { id: uid });
    for (const instrumentId of tp.instruments) {
      const id = await createAssignmentIfMissing({
        uid,
        instrumentId,
        timePoint: tp.id,
        timePointLabel: tp.label,
        dueAt: dueAtForOffset(anchorMs, tp.offsetDays),
        user: profile,
      });
      if (id) created.push(id);
    }
  }
  return { created: created.length };
}

/**
 * 8-week follow-up for both participants, anchored to the pair's first peer message.
 * Idempotent. Does not use schedule:global or Date.now() as the due-date anchor.
 */
export async function assignFollowUpForUsers(userIds, { interventionStartAt } = {}) {
  const startAt = Number(interventionStartAt);
  if (!Number.isFinite(startAt) || startAt <= 0) {
    return { created: 0 };
  }
  const tp = WEEK8_TIME_POINT;
  const dueAt = dueAtForOffset(startAt, tp.offsetDays);
  const created = [];
  for (const uid of userIds || []) {
    if (!uid) continue;
    const profile = await getItem(TABLES.USERS, { id: uid });
    for (const instrumentId of tp.instruments) {
      const id = await createAssignmentIfMissing({
        uid,
        instrumentId,
        timePoint: tp.id,
        timePointLabel: tp.label,
        dueAt,
        user: profile,
      });
      if (id) created.push(id);
    }
  }
  return { created: created.length, dueAt };
}

/**
 * Write-once conversation.intervention_start_at, then assign week8 for both users.
 * Support threads must not call this.
 */
export async function recordPeerInterventionStart(convo, now = Date.now()) {
  if (!convo?.id) return null;
  const users = Array.isArray(convo.users) ? convo.users.filter(Boolean) : [];
  if (users.length < 2) return Number(convo.intervention_start_at || 0) || null;

  let startAt = Number(convo.intervention_start_at || 0) || null;
  if (!startAt) {
    try {
      await updateItem(
        TABLES.CONVERSATIONS,
        { id: convo.id },
        { intervention_start_at: now, updated_at: now },
        {
          condition: (row) => !row?.intervention_start_at,
          conditionExpression: 'attribute_not_exists(intervention_start_at)',
        }
      );
      startAt = now;
    } catch (err) {
      if (err?.name !== 'ConditionalCheckFailedException') throw err;
      const fresh = await getItem(TABLES.CONVERSATIONS, { id: convo.id });
      startAt = Number(fresh?.intervention_start_at || now);
    }
  }

  await assignFollowUpForUsers(users, { interventionStartAt: startAt });
  return startAt;
}

function assignmentIsComplete(row) {
  return row?.status === 'complete' || Boolean(row?.completed_at);
}

export function summarizeBaselineStatus(rows = []) {
  const requiredIds = matchingRequiredInstrumentIds();
  const heldInstrumentIds = BASELINE_INSTRUMENT_IDS.filter(
    (id) => !instrumentIsCompletable(getInstrument(id))
  );
  const byInstrument = {};
  for (const row of rows) {
    if (!row || row.time_point !== BASELINE_TIME_POINT.id) continue;
    byInstrument[row.instrument_id] = row;
  }
  const missingInstrumentIds = requiredIds.filter((id) => !byInstrument[id]);
  const incompleteInstrumentIds = requiredIds.filter(
    (id) => byInstrument[id] && !assignmentIsComplete(byInstrument[id])
  );
  const assignedRequired = requiredIds.filter((id) => byInstrument[id]);
  let status = 'incomplete';
  if (requiredIds.length === 0) {
    status = heldInstrumentIds.length ? 'incomplete' : 'not_assigned';
  } else if (assignedRequired.length === 0) {
    status = 'not_assigned';
  } else if (missingInstrumentIds.length === 0 && incompleteInstrumentIds.length === 0) {
    status = 'complete';
  }
  return {
    complete: status === 'complete',
    status,
    requiredInstrumentIds: requiredIds,
    heldInstrumentIds,
    missingInstrumentIds,
    incompleteInstrumentIds,
  };
}

export async function getBaselineStatusForUser(uid) {
  if (!uid) {
    return summarizeBaselineStatus([]);
  }
  const all = await scan(TABLES.ASSESSMENTS);
  const rows = all.filter((row) => row?.user_id === uid && row?.time_point === BASELINE_TIME_POINT.id);
  return summarizeBaselineStatus(rows);
}

export async function getBaselineStatusMap(userIds) {
  const wanted = Array.isArray(userIds) && userIds.length ? new Set(userIds) : null;
  const all = await scan(TABLES.ASSESSMENTS);
  const byUser = {};
  for (const row of all) {
    if (!row || row.id === SCHEDULE_ID || row.type === 'schedule') continue;
    if (row.time_point !== BASELINE_TIME_POINT.id) continue;
    const uid = row.user_id;
    if (!uid) continue;
    if (wanted && !wanted.has(uid)) continue;
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(row);
  }
  const map = {};
  const ids = wanted ? [...wanted] : Object.keys(byUser);
  for (const uid of ids) {
    map[uid] = summarizeBaselineStatus(byUser[uid] || []);
  }
  return map;
}

export function baselineGateError(label, summary) {
  const missing = [
    ...(summary?.missingInstrumentIds || []),
    ...(summary?.incompleteInstrumentIds || []),
  ];
  const detail = missing.length ? ` Missing: ${missing.join(', ')}.` : '';
  return `Cannot match until ${label} completes baseline assessments.${detail}`;
}

/**
 * Store answers without marking the questionnaire complete.
 */
export async function saveAssignment(id, uid, responses, { isAdmin = false } = {}) {
  const row = await getItem(TABLES.ASSESSMENTS, { id });
  if (!row || row.type === 'schedule') {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }
  if (!isAdmin && row.user_id !== uid) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (!isAdmin && isBaselineTimePoint(row.time_point)) {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }
  const def = getInstrument(row.instrument_id);
  if (def?.staffOnly && !isAdmin) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (!def) {
    const err = new Error('Unknown instrument');
    err.status = 400;
    throw err;
  }
  if (def.scalePending) {
    const err = new Error(
      def.scaleIssue
        || 'This assessment response scale is not confirmed yet. The study team will enable it once the source document is corrected.'
    );
    err.status = 400;
    throw err;
  }
  if (def.contentPending || !def.items?.length) {
    const err = new Error('This assessment is not ready yet. The study team will load the questionnaire.');
    err.status = 400;
    throw err;
  }
  if (isWeek8TimePoint(row.time_point) && Date.now() < Number(row.due_at || 0)) {
    const err = new Error('This 8-week follow-up is not available yet.');
    err.status = 400;
    err.code = 'assessments/not-yet-available';
    throw err;
  }
  if (row.status === 'complete') {
    const schedule = await getSchedule();
    return { assignment: toAssignmentShape(row, schedule) };
  }

  const user = await getItem(TABLES.USERS, { id: row.user_id });
  const incoming = fillOmittedSharedResponses(responses, user, def);
  const cleaned = {};
  for (const item of def.items) {
    if (item.type === 'info') continue;
    if (!itemIsVisible(item, incoming)) continue;
    const val = incoming?.[item.id];
    if (val == null || String(val).trim() === '') continue;
    const trimmed = String(val).trim().slice(0, 4000);
    const allowed = allowedChoiceValues(item);
    if (allowed.length && !allowed.includes(trimmed)) {
      const err = new Error(`Invalid response for "${item.text}"`);
      err.status = 400;
      throw err;
    }
    cleaned[item.id] = trimmed;
    if (item.otherOption && trimmed === String(item.otherOption) && item.otherId) {
      const other = incoming?.[item.otherId];
      if (other != null && String(other).trim() !== '') {
        cleaned[item.otherId] = String(other).trim().slice(0, 4000);
      }
    }
  }

  const now = Date.now();
  await updateItem(TABLES.ASSESSMENTS, { id }, {
    responses: cleaned,
    updated_at: now,
  });
  await syncAssessmentToProfile(row.user_id, incoming);
  const schedule = await getSchedule();
  const updated = await getItem(TABLES.ASSESSMENTS, { id });
  return { assignment: toAssignmentShape(updated, schedule) };
}

export async function submitAssignment(id, uid, responses, { isAdmin = false } = {}) {
  const row = await getItem(TABLES.ASSESSMENTS, { id });
  if (!row || row.type === 'schedule') {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }
  if (!isAdmin && row.user_id !== uid) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (!isAdmin && isBaselineTimePoint(row.time_point)) {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }
  const def = getInstrument(row.instrument_id);
  if (def?.staffOnly && !isAdmin) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (!def) {
    const err = new Error('Unknown instrument');
    err.status = 400;
    throw err;
  }
  if (def.scalePending) {
    const err = new Error(
      def.scaleIssue
        || 'This assessment response scale is not confirmed yet. The study team will enable it once the source document is corrected.'
    );
    err.status = 400;
    throw err;
  }
  if (def.contentPending || !def.items?.length) {
    const err = new Error('This assessment is not ready yet. The study team will load the questionnaire.');
    err.status = 400;
    throw err;
  }

  if (isWeek8TimePoint(row.time_point) && Date.now() < Number(row.due_at || 0)) {
    const err = new Error('This 8-week follow-up is not available yet.');
    err.status = 400;
    err.code = 'assessments/not-yet-available';
    throw err;
  }

  const user = await getItem(TABLES.USERS, { id: row.user_id });
  const incoming = fillOmittedSharedResponses(responses, user, def);
  const cleaned = {};
  for (const item of def.items) {
    if (item.type === 'info') continue;
    if (!itemIsVisible(item, incoming)) continue;
    const val = incoming?.[item.id];
    if ((val == null || String(val).trim() === '') && !item.optional) {
      const err = new Error(`Missing response for "${item.text}"`);
      err.status = 400;
      throw err;
    }
    if (val == null || String(val).trim() === '') continue;
    const trimmed = String(val).trim().slice(0, 4000);
    const allowed = allowedChoiceValues(item);
    if (allowed.length && !allowed.includes(trimmed)) {
      const err = new Error(`Invalid response for "${item.text}"`);
      err.status = 400;
      throw err;
    }
    cleaned[item.id] = trimmed;
    if (item.otherOption && trimmed === String(item.otherOption) && item.otherId) {
      const other = incoming?.[item.otherId];
      if ((other == null || String(other).trim() === '') && !item.otherOptional) {
        const err = new Error(`Please specify a response for "${item.text}"`);
        err.status = 400;
        throw err;
      }
      if (other != null && String(other).trim() !== '') {
        cleaned[item.otherId] = String(other).trim().slice(0, 4000);
      }
    }
  }

  const now = Date.now();
  const exportEnabled = redcapExportEnabled();
  await updateItem(TABLES.ASSESSMENTS, { id }, {
    responses: cleaned,
    status: 'complete',
    completed_at: now,
    redcap_export_status: exportEnabled ? 'pending' : 'unconfigured',
    redcap_export_at: exportEnabled ? null : now,
    redcap_export_error: exportEnabled ? null : redcapUnconfiguredReason(),
    updated_at: now,
  });

  if (exportEnabled) {
    await runRedcapExport(id, row, def, cleaned);
  } else {
    console.warn('[redcap] export skipped', {
      assignmentId: id,
      reason: redcapUnconfiguredReason(),
    });
  }

  await syncAssessmentToProfile(row.user_id, incoming);

  const schedule = await getSchedule();
  const updated = await getItem(TABLES.ASSESSMENTS, { id });
  return { assignment: toAssignmentShape(updated, schedule) };
}

/**
 * Admin retry: re-export stored responses. Never mutates responses or complete status.
 */
export async function retryRedcapExport(id) {
  const row = await getItem(TABLES.ASSESSMENTS, { id });
  if (!row || row.type === 'schedule') {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }
  if (!row.responses || typeof row.responses !== 'object' || !Object.keys(row.responses).length) {
    const err = new Error('No stored responses to export');
    err.status = 400;
    throw err;
  }
  const def = getInstrument(row.instrument_id);
  if (!def) {
    const err = new Error('Unknown instrument');
    err.status = 400;
    throw err;
  }

  const now = Date.now();
  if (redcapExportEnabled()) {
    await updateItem(TABLES.ASSESSMENTS, { id }, {
      redcap_export_status: 'pending',
      redcap_export_at: null,
      redcap_export_error: null,
      updated_at: now,
    });
  }
  await runRedcapExport(id, row, def, row.responses);

  const schedule = await getSchedule();
  const updated = await getItem(TABLES.ASSESSMENTS, { id });
  const assignment = toAssignmentShape(updated, schedule);
  return {
    assignment,
    redcapExportStatus: assignment?.redcapExportStatus || null,
  };
}

const INQ_VALUES = new Set(['1', '2', '3', '4', '5', '6', '7']);

export function intakeSurveyIsComplete(body = {}) {
  const inq = body.inqResponses && typeof body.inqResponses === 'object' ? body.inqResponses : null;
  if (!inq) return false;
  for (let i = 1; i <= 15; i += 1) {
    if (!INQ_VALUES.has(String(inq[`inq_${i}`] ?? ''))) return false;
  }
  return body.cssrsIntake === 'Yes' || body.cssrsIntake === 'No';
}

/**
 * Store intake INQ-15 and C-SSRS question 1 as completed assignments.
 * Field names stay inq_1…inq_15 and cssrs_s1. Does not change baseline or staff Zoom C-SSRS.
 */
export async function recordIntakeSurvey(uid, body = {}) {
  if (!intakeSurveyIsComplete(body)) {
    const err = new Error('Intake INQ and C-SSRS question 1 are required');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  const inqResponses = {};
  for (let i = 1; i <= 15; i += 1) {
    inqResponses[`inq_${i}`] = String(body.inqResponses[`inq_${i}`]);
  }

  await createAssignmentIfMissing({
    uid,
    instrumentId: 'inq15',
    timePoint: INTAKE_TIME_POINT.id,
    timePointLabel: INTAKE_TIME_POINT.label,
    dueAt: now,
  });
  const inqId = assignmentKey(uid, 'inq15', INTAKE_TIME_POINT.id);
  await submitAssignment(inqId, uid, inqResponses);
  await updateItem(TABLES.ASSESSMENTS, { id: inqId }, {
    entry_source: 'intake',
    updated_at: Date.now(),
  });

  await createAssignmentIfMissing({
    uid,
    instrumentId: CSSRS_INTAKE.id,
    timePoint: INTAKE_TIME_POINT.id,
    timePointLabel: INTAKE_TIME_POINT.label,
    dueAt: now,
  });
  const cssrsId = assignmentKey(uid, CSSRS_INTAKE.id, INTAKE_TIME_POINT.id);
  await submitAssignment(cssrsId, uid, { cssrs_s1: body.cssrsIntake });
  await updateItem(TABLES.ASSESSMENTS, { id: cssrsId }, {
    entry_source: 'intake',
    updated_at: Date.now(),
  });
}

/**
 * Staff entry of the Zoom C-SSRS screening onto an enrolled participant.
 * Anonymous screener rows are never created here. The same REDCap export
 * hook used by other assessments runs after the answers are stored.
 */
export async function saveStaffCssrsScreening({ uid, responses, enteredBy, screenerReference }) {
  const participantId = String(uid || '').trim();
  if (!participantId) {
    const err = new Error('uid required');
    err.status = 400;
    throw err;
  }
  const user = await getItem(TABLES.USERS, { id: participantId });
  if (!user) {
    const err = new Error('Participant not found');
    err.status = 404;
    throw err;
  }

  const instrumentId = CSSRS_SCREENING.id;
  const timePoint = CSSRS_SCREENING_TIME_POINT;
  await createAssignmentIfMissing({
    uid: participantId,
    instrumentId,
    timePoint: timePoint.id,
    timePointLabel: timePoint.label,
    dueAt: Date.now(),
    user,
  });

  const id = assignmentKey(participantId, instrumentId, timePoint.id);
  await submitAssignment(id, enteredBy, responses || {}, { isAdmin: true });

  const reference = String(screenerReference || '').trim().slice(0, 200);
  await updateItem(TABLES.ASSESSMENTS, { id }, {
    entered_by: enteredBy || null,
    entry_source: 'staff_zoom',
    record_scope: 'enrolled_participant',
    screener_reference: reference || null,
    updated_at: Date.now(),
  });

  const schedule = await getSchedule();
  const updated = await getItem(TABLES.ASSESSMENTS, { id });
  return { assignment: toAssignmentShape(updated, schedule) };
}

export async function processAssessmentReminders() {
  const schedule = await getSchedule();
  const intervalMs = (schedule.reminderIntervalDays || 3) * 24 * 60 * 60 * 1000;
  const all = await scan(TABLES.ASSESSMENTS);
  const now = Date.now();
  let sent = 0;
  for (const row of all) {
    if (!row || row.id === SCHEDULE_ID || row.type === 'schedule') continue;
    if (isBaselineTimePoint(row.time_point)) continue;
    const status = computeAssignmentStatus(row, now, schedule.dueGraceDays);
    if (!assignmentIsActionable(status)) continue;
    const last = Number(row.last_reminded_at || 0);
    if (last && now - last < intervalMs) continue;
    const user = await getItem(TABLES.USERS, { id: row.user_id });
    if (!user?.email) continue;
    const def = getInstrument(row.instrument_id);
    if (def?.staffOnly || def?.contentPending || def?.scalePending || !def?.items?.length) continue;
    await sendAssessmentReminderEmail(user.email, {
      recipientName: user.display_name || user.displayName || '',
      instrumentTitle: def?.title || row.instrument_id,
      timePointLabel: row.time_point_label || row.time_point,
      dueLabel: status === 'overdue' ? 'overdue' : 'due',
    });
    await updateItem(TABLES.ASSESSMENTS, { id: row.id }, {
      last_reminded_at: now,
      updated_at: now,
    });
    sent += 1;
  }
  return { scanned: all.length, sent };
}
