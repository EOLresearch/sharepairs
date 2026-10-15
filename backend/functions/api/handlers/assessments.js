import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, TABLES } from '../../../shared/database.js';
import { getInstruments, getInstrument, publicInstrument, isBaselineTimePoint } from '../../../shared/assessments/instruments.js';
import { getSchedule, saveSchedule } from '../../../shared/assessments/schedule.js';
import { profileToAssessmentResponses, mergeMissingResponses } from '../../../shared/assessments/prefill.js';
import {
  listAssignments,
  assignAssessmentsForUsers,
  saveAssignment,
  submitAssignment,
  retryRedcapExport,
  saveStaffCssrsScreening,
  toAssignmentShape,
} from '../../../shared/assessments/service.js';

function requireAdmin(auth) {
  if (!auth.isAdmin && !auth.is_admin) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

/**
 * GET /api/assessments/intake — INQ-15 and C-SSRS question 1 for the registration form.
 */
export async function intakeSurvey() {
  return success({
    inq: publicInstrument(getInstrument('inq15')),
    cssrs: publicInstrument(getInstrument('cssrs_intake')),
  });
}

/**
 * GET /api/assessments — current user's assignments
 */
export async function listMine(event) {
  try {
    const auth = await authenticateUser(event);
    const assignments = (await listAssignments({ uid: auth.userId }))
      .filter((row) => !row.staffOnly && row.timePoint !== 'intake' && !isBaselineTimePoint(row.timePoint));
    return success({ assignments });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * GET /api/assessments/:id — assignment + instrument (own or admin)
 */
export async function getOne(event) {
  try {
    const auth = await authenticateUser(event);
    const id = event.pathParameters?.id;
    if (!id) return error('id required', 400);
    const row = await getItem(TABLES.ASSESSMENTS, { id });
    if (!row || row.type === 'schedule') return error('Assessment not found', 404);
    const isAdmin = Boolean(auth.isAdmin || auth.is_admin);
    if (!isAdmin && row.user_id !== auth.userId) return error('Forbidden', 403);
    if (!isAdmin && isBaselineTimePoint(row.time_point)) return error('Assessment not found', 404);
    const defForAccess = getInstrument(row.instrument_id);
    if (defForAccess?.staffOnly && !isAdmin) return error('Assessment not found', 404);
    const schedule = await getSchedule();
    const def = getInstrument(row.instrument_id);
    const canSee = isAdmin || row.user_id === auth.userId;
    let responses = canSee ? (row.responses || null) : null;
    if (canSee && row.status !== 'complete' && !row.completed_at) {
      const user = await getItem(TABLES.USERS, { id: row.user_id });
      const ids = new Set((def?.items || []).map((item) => item.id));
      const merged = mergeMissingResponses(responses, profileToAssessmentResponses(user), ids);
      responses = Object.keys(merged).length ? merged : null;
    }
    return success({
      assignment: {
        ...toAssignmentShape(row, schedule),
        responses,
      },
      instrument: publicInstrument(def),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/assessments/:id/save — { responses }
 * Keeps the current status. Does not mark the questionnaire complete.
 */
export async function save(event) {
  try {
    const auth = await authenticateUser(event);
    const id = event.pathParameters?.id;
    if (!id) return error('id required', 400);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const result = await saveAssignment(id, auth.userId, body.responses || {}, {
      isAdmin: Boolean(auth.isAdmin || auth.is_admin),
    });
    return success({ assignment: result.assignment });
  } catch (err) {
    return error(err.message || 'Save failed', err.status || 400);
  }
}

/**
 * POST /api/assessments/:id/submit — { responses }
 */
export async function submit(event) {
  try {
    const auth = await authenticateUser(event);
    const id = event.pathParameters?.id;
    if (!id) return error('id required', 400);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const result = await submitAssignment(id, auth.userId, body.responses || {}, {
      isAdmin: Boolean(auth.isAdmin || auth.is_admin),
    });
    return success({ assignment: result.assignment });
  } catch (err) {
    return error(err.message || 'Submit failed', err.status || 400);
  }
}

/**
 * GET /api/admin/assessments
 */
export async function adminList(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const qs = event.queryStringParameters || {};
    const assignments = await listAssignments({
      uid: qs.uid || undefined,
      includeResponses: qs.includeResponses === '1',
    });
    return success({ assignments });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * GET /api/admin/assessments/instruments
 */
export async function adminInstruments(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    return success({ instruments: getInstruments().map(publicInstrument) });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * GET /api/admin/assessments/schedule
 * PUT /api/admin/assessments/schedule
 */
export async function adminSchedule(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
    if (method === 'GET') {
      const schedule = await getSchedule();
      return success({ schedule });
    }
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const schedule = await saveSchedule({
      timePoints: body.timePoints || body.time_points,
      dueGraceDays: body.dueGraceDays ?? body.due_grace_days,
      reminderIntervalDays: body.reminderIntervalDays ?? body.reminder_interval_days,
    });
    return success({ schedule });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/assessments/assign — { uid } or { uids: [] }
 * Assigns from the current schedule using now as the anchor (typically match date).
 */
export async function adminAssign(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const uids = Array.isArray(body.uids) ? body.uids : body.uid ? [body.uid] : [];
    if (!uids.length) return error('uid or uids required', 400);
    const result = await assignAssessmentsForUsers(uids, { anchorMs: body.anchorMs || Date.now() });
    return success({ ok: true, ...result });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/assessments/cssrs
 * { uid, responses, screenerReference? }
 * Writes Zoom C-SSRS screening onto an enrolled participant and exports via REDCap.
 */
export async function adminSaveCssrs(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const result = await saveStaffCssrsScreening({
      uid: body.uid,
      responses: body.responses || {},
      enteredBy: auth.userId,
      screenerReference: body.screenerReference || body.screener_reference,
    });
    return success(result);
  } catch (err) {
    return error(err.message || 'Save failed', err.status || 400);
  }
}

/**
 * POST /api/admin/assessments/:id/redcap-retry
 * Re-exports stored responses. Does not change participant answers.
 */
export async function adminRedcapRetry(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const id = event.pathParameters?.id;
    if (!id) return error('id required', 400);
    const result = await retryRedcapExport(id);
    return success(result);
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}
