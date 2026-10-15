/**
 * Shared authenticated fetch for REST APIs.
 * Same-origin on study; localhost only when running locally.
 * Attaches Bearer token from sessionStorage (authService).
 */
import { getStoredToken } from './authService';
import { resolveApiRoot } from '../helpers/apiRoot';

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${resolveApiRoot()}${p}`;
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: options.credentials ?? 'include',
  });
}
