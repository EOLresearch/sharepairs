/**
 * Consent service — accept/respond to conversation requests via REST.
 * Endpoint: /api/consent/respond
 */

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
 * Returns { mutualConsent } or similar.
 */
export async function respondToConsent(requestId, accept = true) {
  const res = await fetch('/api/consent/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, accept }),
    credentials: 'include',
  });
  return handleResponse(res);
}
