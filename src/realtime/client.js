/**
 * Realtime client for WebSocket connection to API Gateway WebSocket.
 * - wss:// only (TLS). JWT in memory. No PHI in console.
 * - Reconnect with exponential backoff + jitter. Heartbeat. Optional backfill on reconnect.
 */

const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

let cachedRuntimeWsUrl = null;
let runtimeWsUrlPromise = null;

function resolveWsUrlSync(override) {
  if (override) return override;
  if (cachedRuntimeWsUrl) return cachedRuntimeWsUrl;
  const onLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const explicit = process.env.REACT_APP_WS_URL;
  if (explicit) {
    const url = explicit.replace(/^http/, 'ws');
    if (/localhost|127\.0\.0\.1/.test(url) && !onLocalHost) {
      console.warn('[realtime] Ignoring localhost REACT_APP_WS_URL on a non-local host');
    } else {
      return url;
    }
  }
  if (onLocalHost) {
    return `ws://${window.location.hostname}:3001/ws`;
  }
  return null;
}

/** Fetch wss URL from API when CRA build has no REACT_APP_WS_URL (CloudShell prebuilt zips). */
async function resolveWsUrl(override) {
  const sync = resolveWsUrlSync(override);
  if (sync) return sync;
  if (typeof window === 'undefined') return null;
  if (!runtimeWsUrlPromise) {
    runtimeWsUrlPromise = (async () => {
      try {
        const { resolveApiRoot } = await import('../helpers/apiRoot');
        const res = await fetch(`${resolveApiRoot()}/api/realtime/config`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok) return null;
        const data = await res.json();
        const url = data?.wsUrl ? String(data.wsUrl).replace(/^http/, 'ws') : null;
        if (url) cachedRuntimeWsUrl = url;
        return url;
      } catch {
        return null;
      }
    })();
  }
  return runtimeWsUrlPromise;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 25000;
const HEARTBEAT_TIMEOUT_MS = 5000;

let ws = null;
let state = CONNECTION_STATES.DISCONNECTED;
let tokenGetter = null;
let backfillCallback = null;
let listeners = {}; // eventType -> Set<handler>
let retryCount = 0;
let retryTimeoutId = null;
let heartbeatIntervalId = null;
let heartbeatTimeoutId = null;
let lastSeenByConversationId = {};
let didReconnectWithFreshToken = false;
const presenceMap = {}; // userId -> 'online' | 'offline' (for future use)

let urlOverride = null;

async function getWsUrl() {
  const url = await resolveWsUrl(urlOverride);
  if (!url) return null;
  if (url.startsWith('ws://') || url.startsWith('wss://')) return url;
  return `wss://${url}`;
}

function setConnectionState(next) {
  if (state === next) return;
  state = next;
  emit('connectionStateChange', { state });
}

function emit(eventType, payload) {
  const set = listeners[eventType];
  if (!set) return;
  set.forEach((handler) => {
    try {
      handler(payload);
    } catch (_) {
      // avoid one handler breaking others; no PHI in logs
    }
  });
}

function jitter(maxMs) {
  return Math.floor(Math.random() * (maxMs + 1));
}

function getBackoffDelay() {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
  return exponential + jitter(1000);
}

function clearHeartbeat() {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  if (heartbeatTimeoutId) {
    clearTimeout(heartbeatTimeoutId);
    heartbeatTimeoutId = null;
  }
}

function scheduleReconnect() {
  if (retryTimeoutId) return;
  if (retryCount >= MAX_RETRIES) {
    setConnectionState(CONNECTION_STATES.ERROR);
    emit('reconnectFailed', { retries: retryCount });
    return;
  }
  const delay = getBackoffDelay();
  retryTimeoutId = setTimeout(() => {
    retryTimeoutId = null;
    retryCount += 1;
    connect(tokenGetter, { backfill: backfillCallback, url: urlOverride });
  }, delay);
}

function startHeartbeat() {
  clearHeartbeat();
  heartbeatIntervalId = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const ping = JSON.stringify({ type: 'ping' });
    ws.send(ping);
    heartbeatTimeoutId = setTimeout(() => {
      // no pong in time — treat as stale
      if (ws) ws.close(4000, 'heartbeat_timeout');
    }, HEARTBEAT_TIMEOUT_MS);
  }, HEARTBEAT_INTERVAL_MS);
}

function onPongOrHeartbeat() {
  if (heartbeatTimeoutId) {
    clearTimeout(heartbeatTimeoutId);
    heartbeatTimeoutId = null;
  }
}

function runBackfill() {
  if (!backfillCallback || Object.keys(lastSeenByConversationId).length === 0) return;
  Object.entries(lastSeenByConversationId).forEach(([conversationId, since]) => {
    backfillCallback(conversationId, since).catch(() => {});
  });
}

function handleMessage(event) {
  let data;
  try {
    data = JSON.parse(event.data);
  } catch {
    return;
  }
  const type = data.type || 'message';
  const payload = data.payload ?? data;

  if (type === 'pong' || type === 'heartbeat') {
    onPongOrHeartbeat();
    return;
  }

  if (type === 'presence' && payload.userId != null) {
    presenceMap[payload.userId] = payload.status === 'offline' ? 'offline' : 'online';
  }

  if (payload.conversationId && payload.timestamp) {
    const convId = payload.conversationId;
    const ts = payload.timestamp;
    if (!lastSeenByConversationId[convId] || ts > lastSeenByConversationId[convId]) {
      lastSeenByConversationId[convId] = ts;
    }
  }

  emit(type, payload);
}

function handleClose(event) {
  clearHeartbeat();
  ws = null;
  setConnectionState(CONNECTION_STATES.DISCONNECTED);

  const code = event.code;
  const wasClean = event.wasClean;

  if (code === 4001 || code === 401 || (code === 4003 && event.reason?.includes('auth'))) {
    if (!didReconnectWithFreshToken && tokenGetter) {
      didReconnectWithFreshToken = true;
      retryCount = 0;
      setTimeout(() => connect(tokenGetter, { backfill: backfillCallback, url: urlOverride }), 500);
      return;
    }
  }

  didReconnectWithFreshToken = false;
  if (!wasClean && code !== 1000) {
    scheduleReconnect();
  }
}

async function sendAuth() {
  if (!tokenGetter || !ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    const t = tokenGetter();
    const token = typeof t?.then === 'function' ? await t : t;
    if (token) ws.send(JSON.stringify({ type: 'auth', token }));
  } catch (_) {}
}

function handleOpen() {
  retryCount = 0;
  setConnectionState(CONNECTION_STATES.CONNECTED);
  startHeartbeat();
  sendAuth();

  if (backfillCallback && Object.keys(lastSeenByConversationId).length > 0) {
    runBackfill();
  }
}

function handleError() {
  setConnectionState(CONNECTION_STATES.ERROR);
}

/**
 * Connect to the WebSocket endpoint. Uses wss:// only.
 * @param {() => string | Promise<string>} getToken - returns JWT for auth message
 * @param {{ backfill?: (conversationId: string, since: string) => Promise<any> }} options
 */
export async function connect(getToken, options = {}) {
  urlOverride = options.url || null;
  const baseUrl = await getWsUrl();
  if (!baseUrl) {
    console.error('[realtime] No WebSocket URL (set REACT_APP_WS_URL or WEBSOCKET_API_ENDPOINT on API).');
    setConnectionState(CONNECTION_STATES.ERROR);
    return;
  }

  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  tokenGetter = getToken;
  backfillCallback = options.backfill || null;
  setConnectionState(CONNECTION_STATES.CONNECTING);

  let url = baseUrl;
  try {
    const t = getToken?.();
    const token = typeof t?.then === 'function' ? await t : t;
    if (token) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}token=${encodeURIComponent(token)}`;
    }
  } catch {
    // connect without token; server may reject
  }

  try {
    const socket = new WebSocket(url);
    ws = socket;

    socket.onopen = handleOpen;
    socket.onmessage = handleMessage;
    socket.onclose = handleClose;
    socket.onerror = handleError;
  } catch (e) {
    setConnectionState(CONNECTION_STATES.ERROR);
    scheduleReconnect();
  }
}

/**
 * Disconnect and stop reconnecting.
 */
export function disconnect() {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
  clearHeartbeat();
  retryCount = 0;
  didReconnectWithFreshToken = false;
  if (ws) {
    ws.close(1000, 'client_disconnect');
    ws = null;
  }
  setConnectionState(CONNECTION_STATES.DISCONNECTED);
}

/**
 * Register a handler for an event type (e.g. 'message', 'consentUpdate', 'distressUpdate', 'connectionStateChange').
 * @param {string} eventType
 * @param {(payload: any) => void} handler
 */
export function on(eventType, handler) {
  if (!listeners[eventType]) listeners[eventType] = new Set();
  listeners[eventType].add(handler);
}

/**
 * Remove a previously registered handler.
 * @param {string} eventType
 * @param {(payload: any) => void} handler
 */
export function off(eventType, handler) {
  const set = listeners[eventType];
  if (set) set.delete(handler);
}

/**
 * Send an outbound event (e.g. new message, typing, presence).
 * @param {string} type
 * @param {object} payload
 */
export function send(type, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, payload: payload ?? {} }));
}

/**
 * Current connection state: 'disconnected' | 'connecting' | 'connected' | 'error'
 */
export function getConnectionState() {
  return state;
}

/**
 * Call after reconnect if you want to run backfill for missed messages.
 * Optional: pass backfill in connect() and it runs automatically on reconnect.
 */
export function getLastSeenByConversation() {
  return { ...lastSeenByConversationId };
}

/**
 * Presence: in-memory user online/offline map. Updated when backend sends presence events.
 */
export function getPresenceMap() {
  return { ...presenceMap };
}
