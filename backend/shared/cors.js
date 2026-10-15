import { config } from './config.js';

/**
 * Browser-safe CORS headers.
 * Never pair Access-Control-Allow-Origin: * with Allow-Credentials: true.
 */
export function corsHeaders(requestOrigin) {
  const configured = config.corsOrigin || '*';
  let allowOrigin = configured;
  if (configured === '*') {
    // Reflect request origin when present so credentialed same-site fetches work;
    // fall back to * without credentials.
    allowOrigin = requestOrigin || '*';
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  };
  if (allowOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers.Vary = 'Origin';
  }
  return headers;
}

export function withCors(response, requestOrigin) {
  return {
    ...response,
    headers: { ...corsHeaders(requestOrigin), ...(response.headers || {}) },
  };
}

export function corsPreflight(requestOrigin) {
  return withCors({ statusCode: 204, body: '' }, requestOrigin);
}
