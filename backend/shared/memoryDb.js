/**
 * In-memory table store for unit tests (MEMORY_DB=true).
 * Supports get/put/update/delete/query(email-index)/scan.
 */

const tables = new Map();

function tableMap(name) {
  if (!tables.has(name)) tables.set(name, new Map());
  return tables.get(name);
}

function keyString(key) {
  return Object.keys(key)
    .sort()
    .map((k) => `${k}=${key[k]}`)
    .join('|');
}

export function resetMemoryDb() {
  tables.clear();
}

export async function memoryGetItem(tableName, key) {
  const item = tableMap(tableName).get(keyString(key));
  return item ? structuredClone(item) : null;
}

export async function memoryPutItem(tableName, item) {
  const key = item.id != null
    ? { id: item.id }
    : item.conversation_id != null
      ? { conversation_id: item.conversation_id, message_id: item.message_id }
      : null;
  if (!key) throw new Error('memoryPutItem: cannot infer key');
  tableMap(tableName).set(keyString(key), structuredClone(item));
  return item;
}

export async function memoryUpdateItem(tableName, key, updates) {
  const map = tableMap(tableName);
  const ks = keyString(key);
  const existing = map.get(ks);
  if (!existing) return null;
  const next = { ...existing };
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined) delete next[k];
    else next[k] = v;
  }
  map.set(ks, next);
  return structuredClone(next);
}

export async function memoryIncrementAttrs(tableName, key, increments) {
  const map = tableMap(tableName);
  const ks = keyString(key);
  const existing = map.get(ks);
  if (!existing) return null;
  const next = { ...existing };
  for (const [attr, delta] of Object.entries(increments || {})) {
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) continue;
    next[attr] = Number(next[attr] || 0) + n;
  }
  map.set(ks, next);
  return structuredClone(next);
}

export async function memoryDeleteItem(tableName, key) {
  tableMap(tableName).delete(keyString(key));
}

export async function memoryQuery(tableName, params = {}) {
  const items = [...tableMap(tableName).values()];
  const values = params.ExpressionAttributeValues || {};

  if (params.IndexName === 'email-index') {
    const email = values[':email'];
    return items
      .filter((u) => (u.email || '').toLowerCase() === String(email || '').toLowerCase())
      .map((u) => structuredClone(u));
  }

  // Distress (and similar): GSI user-index on user_id (+ optional created_at)
  if (params.IndexName === 'user-index') {
    const userId = values[':userId'] ?? values[':user_id'];
    let rows = items.filter((row) => row.user_id === userId || row.userId === userId);
    rows.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    if (params.ScanIndexForward === true) {
      rows = rows.reverse();
    }
    if (params.Limit != null) rows = rows.slice(0, Number(params.Limit));
    return rows.map((u) => structuredClone(u));
  }

  // Conversations: GSI user-id-index — in Dynamo this is a per-user projection;
  // in memory we filter the users[] membership (no duplicate rows).
  if (params.IndexName === 'user-id-index') {
    const userId = values[':uid'] ?? values[':userId'] ?? values[':user_id'];
    const uid = String(userId || '');
    let rows = items.filter((row) => {
      if (row.user_id === uid || row.userId === uid) return true;
      const users = row.users || [];
      return Array.isArray(users) && users.map(String).includes(uid);
    });
    rows.sort((a, b) => Number(b.updated_at || b.created_at || 0) - Number(a.updated_at || a.created_at || 0));
    if (params.Limit != null) rows = rows.slice(0, Number(params.Limit));
    return rows.map((u) => structuredClone(u));
  }

  // Messages table: PK conversation_id, SK message_id (sorted by created_at for chat)
  const cid = values[':cid'] ?? values[':conversation_id'];
  if (cid != null || /conversation_id\s*=/.test(params.KeyConditionExpression || '')) {
    let rows = items.filter(
      (row) => row.conversation_id === cid || row.conversationId === cid
    );
    // Newest first by default (ScanIndexForward: false), oldest first when true
    rows.sort((a, b) => {
      const at = Number(a.created_at || 0);
      const bt = Number(b.created_at || 0);
      if (at !== bt) return bt - at;
      return String(b.message_id || '').localeCompare(String(a.message_id || ''));
    });
    if (params.ScanIndexForward === true) {
      rows = rows.reverse();
    }
    if (params.ExclusiveStartKey?.message_id) {
      const beforeId = params.ExclusiveStartKey.message_id;
      const idx = rows.findIndex((r) => r.message_id === beforeId);
      if (idx >= 0) rows = rows.slice(idx + 1);
    }
    if (params.Limit != null) rows = rows.slice(0, Number(params.Limit));
    return rows.map((u) => structuredClone(u));
  }

  return items.map((u) => structuredClone(u));
}

export async function memoryScan(tableName) {
  return [...tableMap(tableName).values()].map((u) => structuredClone(u));
}
