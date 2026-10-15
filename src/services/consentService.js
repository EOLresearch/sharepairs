/**
 * Consent service — accept/respond to conversation requests via REST.
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

/**
 * Respond to a conversation request (accept or decline).
 * requestId is the conversation doc ID.
 */
export async function respondToConsent(requestId, accept = true) {
  const res = await apiFetch('/api/consent/respond', {
    method: 'POST',
    body: JSON.stringify({ requestId, accept }),
  });
  return handleResponse(res);
}
