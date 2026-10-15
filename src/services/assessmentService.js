/**
 * Participant and admin assessment APIs.
 * REDCap credentials stay on the server (env only).
 */

import { apiFetch } from './http';

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.code;
    throw err;
  }
  return data;
}

export async function getMyAssessments() {
  const res = await apiFetch('/api/assessments');
  const data = await handleResponse(res);
  return Array.isArray(data.assignments) ? data.assignments : [];
}

export async function getAssessment(id) {
  const res = await apiFetch(`/api/assessments/${encodeURIComponent(id)}`);
  return handleResponse(res);
}

export async function saveAssessment(id, responses) {
  const res = await apiFetch(`/api/assessments/${encodeURIComponent(id)}/save`, {
    method: 'POST',
    body: JSON.stringify({ responses }),
  });
  return handleResponse(res);
}

export async function submitAssessment(id, responses) {
  const res = await apiFetch(`/api/assessments/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ responses }),
  });
  return handleResponse(res);
}

export async function getAdminAssessments(params = {}) {
  const qs = new URLSearchParams();
  if (params.uid) qs.set('uid', params.uid);
  if (params.includeResponses) qs.set('includeResponses', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch(`/api/admin/assessments${suffix}`);
  const data = await handleResponse(res);
  return Array.isArray(data.assignments) ? data.assignments : [];
}

export async function getAdminInstruments() {
  const res = await apiFetch('/api/admin/assessments/instruments');
  const data = await handleResponse(res);
  return Array.isArray(data.instruments) ? data.instruments : [];
}

export async function getAdminSchedule() {
  const res = await apiFetch('/api/admin/assessments/schedule');
  const data = await handleResponse(res);
  return data.schedule;
}

export async function saveAdminSchedule(payload) {
  const res = await apiFetch('/api/admin/assessments/schedule', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  return data.schedule;
}

export async function assignAssessments(uidOrUids, { anchorMs } = {}) {
  const body = Array.isArray(uidOrUids)
    ? { uids: uidOrUids, anchorMs }
    : { uid: uidOrUids, anchorMs };
  const res = await apiFetch('/api/admin/assessments/assign', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function saveStaffCssrs(uid, responses, screenerReference) {
  const res = await apiFetch('/api/admin/assessments/cssrs', {
    method: 'POST',
    body: JSON.stringify({ uid, responses, screenerReference }),
  });
  return handleResponse(res);
}

export async function retryRedcapExport(id) {
  const res = await apiFetch(`/api/admin/assessments/${encodeURIComponent(id)}/redcap-retry`, {
    method: 'POST',
    body: '{}',
  });
  return handleResponse(res);
}
