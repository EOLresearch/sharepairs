import { onConnect, onDisconnect, onMessage } from './handlers.js';

export const handler = async (event) => {
  const routeKey = event.requestContext?.routeKey || '$default';

  try {
    if (routeKey === '$connect') return await onConnect(event);
    if (routeKey === '$disconnect') return await onDisconnect(event);
    return await onMessage(event);
  } catch (err) {
    console.error('WebSocket handler error:', err);
    return { statusCode: 500, body: 'Internal error' };
  }
};
