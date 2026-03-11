import { withCors } from './cors.js';

/**
 * Standardized API response helpers (with CORS)
 */
export function success(data, statusCode = 200) {
  return withCors({
    statusCode,
    body: JSON.stringify(data),
  });
}

export function error(message, statusCode = 400, details = null) {
  const body = { error: message };
  if (details) body.details = details;
  return withCors({
    statusCode,
    body: JSON.stringify(body),
  });
}

