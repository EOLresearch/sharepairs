/**
 * Single Lambda router for API Gateway HTTP API (v2) or REST API.
 * Routes by path + method; returns Lambda response (statusCode, headers, body).
 */
import { success, error } from '../../shared/response.js';
import { corsPreflight } from '../../shared/cors.js';
import * as authHandlers from './handlers/auth.js';
import * as matchesHandlers from './handlers/matches.js';
import * as messagesHandlers from './handlers/messages.js';
import * as consentHandlers from './handlers/consent.js';
import * as conversationsHandlers from './handlers/conversations.js';

function getPath(event) {
  // HTTP API payload 2.0: rawPath. Payload 1.0 / some proxies: path may include stage.
  let path = event.rawPath || event.path || event.requestContext?.http?.path || '';
  const stage = event.requestContext?.stage;
  if (stage && stage !== '$default') {
    if (path === `/${stage}`) path = '/';
    else if (path.startsWith(`/${stage}/`)) path = path.slice(stage.length + 1);
  }
  // Also strip a bare /prod prefix if stage metadata is missing
  if (path.startsWith('/prod/')) path = path.slice('/prod'.length);
  return path;
}

function getMethod(event) {
  return (event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || 'GET').toUpperCase();
}

const routes = [
  { method: 'OPTIONS', path: '/api', handler: () => corsPreflight() },
  { method: 'POST', path: '/api/auth/login', handler: authHandlers.login },
  { method: 'GET', path: '/api/auth/me', handler: authHandlers.me },
  { method: 'PATCH', path: '/api/auth/me', handler: authHandlers.mePatch },
  { method: 'GET', path: '/api/matches', handler: matchesHandlers.getMatches },
  { method: 'GET', path: '/api/messages', handler: messagesHandlers.getMessages },
  { method: 'POST', path: '/api/messages/send', handler: messagesHandlers.sendMessage },
  { method: 'POST', path: '/api/messages/seen', handler: messagesHandlers.markSeen },
  { method: 'POST', path: '/api/consent/request', handler: consentHandlers.consentRequest },
  { method: 'POST', path: '/api/consent/respond', handler: consentHandlers.consentRespond },
  { method: 'GET', path: '/api/conversations', handler: conversationsHandlers.listConversations },
  { method: 'POST', path: '/api/conversations', handler: conversationsHandlers.createConversation },
];

export async function route(event) {
  if (getMethod(event) === 'OPTIONS') {
    return corsPreflight();
  }

  const path = getPath(event);
  const method = getMethod(event);

  for (const r of routes) {
    if (r.method === method && path === r.path) {
      try {
        return await r.handler(event);
      } catch (err) {
        console.error('Handler error:', err);
        return error(err.message || 'Internal server error', 500);
      }
    }
  }

  console.warn('No route match', { method, path, rawPath: event.rawPath, eventPath: event.path });
  return error('Not Found', 404);
}
