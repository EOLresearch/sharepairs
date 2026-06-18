import { putItem, deleteItem, query } from './database.js';
import { TABLES } from './database.js';

export async function addConnection(connectionId, userId) {
  await putItem(TABLES.CONNECTIONS, {
    connection_id: connectionId,
    user_id: userId,
    connected_at: Date.now(),
  });
}

export async function removeConnection(connectionId) {
  await deleteItem(TABLES.CONNECTIONS, { connection_id: connectionId });
}

export async function getConnectionsByUserId(userId) {
  if (!userId) return [];
  try {
    return await query(TABLES.CONNECTIONS, {
      IndexName: 'user-id-index',
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    });
  } catch {
    return [];
  }
}
