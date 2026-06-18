import { authenticateToken } from '../../shared/auth.js';
import { addConnection, removeConnection } from '../../shared/connections.js';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { config } from '../../shared/config.js';

function wsResponse(connectionId, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return { statusCode: 200, body: payload };
}

async function postToConnection(event, connectionId, message) {
  const endpoint = config.websocketEndpoint;
  if (!endpoint) return;
  const client = new ApiGatewayManagementApiClient({ endpoint });
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(message),
    })
  );
}

/**
 * $connect — authenticate via ?token= query param.
 */
export async function onConnect(event) {
  const connectionId = event.requestContext?.connectionId;
  const token =
    event.queryStringParameters?.token ||
    event.headers?.Authorization?.replace(/^Bearer\s+/i, '') ||
    event.headers?.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const auth = await authenticateToken(token);
    await addConnection(connectionId, auth.userId);
    return { statusCode: 200, body: 'Connected' };
  } catch {
    return { statusCode: 401, body: 'Unauthorized' };
  }
}

/**
 * $disconnect — remove connection record.
 */
export async function onDisconnect(event) {
  const connectionId = event.requestContext?.connectionId;
  if (connectionId) {
    await removeConnection(connectionId);
  }
  return { statusCode: 200, body: 'Disconnected' };
}

/**
 * $default — handle ping and late auth messages.
 */
export async function onMessage(event) {
  const connectionId = event.requestContext?.connectionId;
  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return wsResponse(connectionId, { type: 'error', payload: { message: 'Invalid JSON' } });
  }

  const type = data.type || 'message';
  const payload = data.payload ?? data;

  if (type === 'ping') {
    if (config.websocketEndpoint) {
      await postToConnection(event, connectionId, { type: 'pong' });
    }
    return wsResponse(connectionId, { type: 'pong' });
  }

  if (type === 'auth') {
    const token = payload.token;
    if (!token) {
      return wsResponse(connectionId, { type: 'error', payload: { message: 'token required' } });
    }
    try {
      const auth = await authenticateToken(token);
      await addConnection(connectionId, auth.userId);
      return wsResponse(connectionId, { type: 'authOk', payload: { userId: auth.userId } });
    } catch {
      return wsResponse(connectionId, { type: 'error', payload: { message: 'Unauthorized' } });
    }
  }

  return wsResponse(connectionId, { type: 'ack' });
}
