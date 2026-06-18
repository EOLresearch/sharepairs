/**
 * In-memory WebSocket connection registry for local dev server.
 * Maps userId -> Set<WebSocket>
 */

const byUser = new Map();
const bySocket = new Map();

export function registerLocalConnection(ws, userId) {
  if (!ws || !userId) return;
  bySocket.set(ws, userId);
  if (!byUser.has(userId)) byUser.set(userId, new Set());
  byUser.get(userId).add(ws);
}

export function unregisterLocalConnection(ws) {
  const userId = bySocket.get(ws);
  if (!userId) return;
  bySocket.delete(ws);
  const set = byUser.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) byUser.delete(userId);
  }
}

export function sendLocal(userId, data) {
  const set = byUser.get(userId);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === 1) {
      try {
        ws.send(data);
      } catch {
        unregisterLocalConnection(ws);
      }
    }
  }
}

export function clearLocalConnections() {
  byUser.clear();
  bySocket.clear();
}
