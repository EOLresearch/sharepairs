import { withCors } from './cors.js';

let _requestOrigin = null;

/** Set per-request Origin for CORS reflection (called from router). */
export function setRequestOrigin(origin) {
  _requestOrigin = origin || null;
}

/**
 * Standardized API response helpers (with CORS)
 */
export function success(data, statusCode = 200) {
  return withCors(
    {
      statusCode,
      body: JSON.stringify(data),
    },
    _requestOrigin
  );
}

export function error(message, statusCode = 400, details = null) {
  const body = { error: message, message };
  if (details) {
    body.details = details;
    if (details.code) body.code = details.code;
  }
  return withCors(
    {
      statusCode,
      body: JSON.stringify(body),
    },
    _requestOrigin
  );
}
