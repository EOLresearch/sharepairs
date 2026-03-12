/**
 * Connection/reconnect state: ping with exponential backoff, expose status for polling and sync.
 * Used by ConnectionContext and by services that should skip requests while reconnecting.
 */

const PING_PATH = '/api/auth/me';
const PING_INTERVAL_MS = 15_000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

function getBaseUrl() {
  if (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return '';
  }
  return 'http://localhost:3001';
}

/**
 * Ping the API to detect connectivity. Resolves to true if server responded (2xx or 401), false on network error or 5xx.
 * 401 is treated as "reachable" so we don't enter reconnecting when the session expires.
 */
export async function ping() {
  const url = getBaseUrl() ? `${getBaseUrl()}${PING_PATH}` : PING_PATH;
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status >= 200 && res.status < 300) return true;
    if (res.status === 401) return true; // server reachable, auth issue only
    return false;
  } catch {
    return false;
  }
}

/**
 * Current connection state for non-React consumers (e.g. polling loops).
 * { status: 'online' | 'reconnecting', lastError: string | null, reconnectGeneration: number }
 */
let currentState = {
  status: 'online',
  lastError: null,
  reconnectGeneration: 0,
};

const listeners = new Set();

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb(currentState);
    } catch (e) {
      console.warn('Connection state listener error:', e);
    }
  });
}

export function getConnectionState() {
  return { ...currentState };
}

export function addConnectionListener(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setConnectionState(update) {
  const next = { ...currentState, ...update };
  if (
    next.status !== currentState.status ||
    next.reconnectGeneration !== currentState.reconnectGeneration
  ) {
    currentState = next;
    notifyListeners();
  } else {
    currentState = next;
  }
}

export function getBackoffConfig() {
  return {
    initialMs: BACKOFF_INITIAL_MS,
    maxMs: BACKOFF_MAX_MS,
    multiplier: BACKOFF_MULTIPLIER,
  };
}

export { PING_INTERVAL_MS, BACKOFF_INITIAL_MS, BACKOFF_MAX_MS, BACKOFF_MULTIPLIER };
