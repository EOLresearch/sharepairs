import { success } from '../../../shared/response.js';
import { config } from '../../../shared/config.js';

/**
 * Public runtime config for the browser (no secrets).
 * Lets CloudFront builds discover the WebSocket URL without a rebuild.
 */
export async function getRealtimeConfig() {
  const endpoint = config.websocketEndpoint;
  let wsUrl = null;
  if (endpoint) {
    wsUrl = String(endpoint).replace(/^http/, 'ws');
  }
  return success({
    wsUrl,
    configured: Boolean(wsUrl),
  });
}
