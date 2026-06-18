import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { deleteItem } from './database.js';
import { TABLES } from './database.js';
import { getConnectionsByUserId } from './connections.js';
import { sendLocal } from './localConnections.js';
import { config } from './config.js';

let wsClient = null;

function getWsClient() {
  if (!config.websocketEndpoint) return null;
  if (!wsClient) {
    wsClient = new ApiGatewayManagementApiClient({
      endpoint: config.websocketEndpoint,
    });
  }
  return wsClient;
}

async function postToConnection(connectionId, data) {
  const client = getWsClient();
  if (!client) return;
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: data,
      })
    );
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 410 || err?.statusCode === 410) {
      await deleteItem(TABLES.CONNECTIONS, { connection_id: connectionId });
    }
  }
}

/**
 * Push a realtime event to one or more users.
 * @param {string[]} userIds
 * @param {{ type: string, payload?: object }} message
 */
export async function broadcastToUsers(userIds, message) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (unique.length === 0) return;

  const data = JSON.stringify(message);

  if (config.useLocalConnections) {
    for (const uid of unique) {
      sendLocal(uid, data);
    }
    return;
  }

  for (const uid of unique) {
    const connections = await getConnectionsByUserId(uid);
    await Promise.all(
      connections.map((conn) => postToConnection(conn.connection_id, data))
    );
  }
}
