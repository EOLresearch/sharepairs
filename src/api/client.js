/**
 * Central API client for calling the backend (API Gateway + Lambda).
 * - Attaches Authorization: Bearer <token>
 * - Retries once on 5xx errors
 * - Use setTokenGetter() to supply the JWT (e.g. from Cognito or Firebase)
 */

const getBaseUrl = () =>
  process.env.REACT_APP_API_URL || 'http://localhost:3001';

let tokenGetter = null;

/**
 * Set a function that returns the current access token (string or Promise<string>).
 * Call this at app init with your auth provider (e.g. Cognito getIdToken, Firebase getIdToken).
 * @param {() => string | Promise<string>} fn
 */
export function setTokenGetter(fn) {
  tokenGetter = fn;
}

/**
 * Get the current token (resolve if async).
 * @returns {Promise<string | null>}
 */
async function getToken() {
  if (!tokenGetter) return null;
  const t = tokenGetter();
  return typeof t?.then === 'function' ? t : t;
}

/**
 * Build request options with auth header and optional overrides.
 * @param {string} method
 * @param {RequestInit & { token?: string }} options
 * @returns {Promise<RequestInit>}
 */
async function requestOptions(method, options = {}) {
  const { token: tokenOverride, ...fetchOptions } = options;
  const token = tokenOverride != null ? tokenOverride : await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return {
    method,
    ...fetchOptions,
    credentials: fetchOptions.credentials ?? 'include',
    headers,
  };
}

/**
 * Execute fetch with optional single retry on 5xx.
 * @param {string} url
 * @param {RequestInit} opts
 * @param {boolean} isRetry
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, opts, isRetry = false) {
  const res = await fetch(url, opts);
  if (res.status >= 500 && res.status < 600 && !isRetry) {
    // Retry once on server error
    return fetchWithRetry(url, opts, true);
  }
  // TODO: refresh-token logic — on 401, call refresh endpoint, update token, retry once
  return res;
}

/**
 * Parse JSON or return null; throw if not ok (unless options.allowErrorResponse).
 */
async function handleResponse(res, options = {}) {
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (options.allowErrorResponse) return { ok: res.ok, status: res.status, data };
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.response = data;
    throw err;
  }
  return data;
}

/**
 * GET request.
 * @param {string} path - Path (e.g. '/users/me'), will be appended to base URL
 * @param {{ token?: string, headers?: Record<string, string>, allowErrorResponse?: boolean }} options
 * @returns {Promise<any>}
 */
export async function apiGet(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const opts = await requestOptions('GET', options);
  const res = await fetchWithRetry(url, opts);
  return handleResponse(res, options);
}

/**
 * POST request.
 * @param {string} path
 * @param {object} body - Will be JSON.stringify'd
 * @param {{ token?: string, headers?: Record<string, string>, allowErrorResponse?: boolean }} options
 * @returns {Promise<any>}
 */
export async function apiPost(path, body, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const opts = await requestOptions('POST', { ...options, body: body != null ? JSON.stringify(body) : undefined });
  const res = await fetchWithRetry(url, opts);
  return handleResponse(res, options);
}

/**
 * PUT request.
 * @param {string} path
 * @param {object} body
 * @param {{ token?: string, headers?: Record<string, string>, allowErrorResponse?: boolean }} options
 * @returns {Promise<any>}
 */
export async function apiPut(path, body, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const opts = await requestOptions('PUT', { ...options, body: body != null ? JSON.stringify(body) : undefined });
  const res = await fetchWithRetry(url, opts);
  return handleResponse(res, options);
}

/**
 * PATCH request.
 * @param {string} path
 * @param {object} body
 * @param {{ token?: string, headers?: Record<string, string>, allowErrorResponse?: boolean }} options
 * @returns {Promise<any>}
 */
export async function apiPatch(path, body, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const opts = await requestOptions('PATCH', { ...options, body: body != null ? JSON.stringify(body) : undefined });
  const res = await fetchWithRetry(url, opts);
  return handleResponse(res, options);
}

/**
 * DELETE request.
 * @param {string} path
 * @param {{ token?: string, headers?: Record<string, string>, allowErrorResponse?: boolean }} options
 * @returns {Promise<any>}
 */
export async function apiDelete(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const opts = await requestOptions('DELETE', options);
  const res = await fetchWithRetry(url, opts);
  return handleResponse(res, options);
}
