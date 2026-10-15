/**
 * Single Lambda router for API Gateway HTTP API (v2) or REST API.
 * Routes by path + method; returns Lambda response (statusCode, headers, body).
 * Path segments starting with `:` become pathParameters (e.g. /api/admin/prompts/:id).
 */
import { success, error, setRequestOrigin } from '../../shared/response.js';
import { corsPreflight } from '../../shared/cors.js';
import * as authHandlers from './handlers/auth.js';
import * as matchesHandlers from './handlers/matches.js';
import * as messagesHandlers from './handlers/messages.js';
import * as consentHandlers from './handlers/consent.js';
import * as conversationsHandlers from './handlers/conversations.js';
import * as adminHandlers from './handlers/admin.js';
import * as promptsHandlers from './handlers/prompts.js';
import * as realtimeHandlers from './handlers/realtime.js';
import * as assessmentHandlers from './handlers/assessments.js';
import * as distressHandlers from './handlers/distress.js';
import * as demoTutorialHandlers from './handlers/demoTutorial.js';

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

/** Match /api/foo/:id style routes; returns params object or null. */
function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const vp = pathParts[i];
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(vp);
    } else if (pp !== vp) {
      return null;
    }
  }
  return params;
}

const routes = [
  { method: 'OPTIONS', path: '/api', handler: () => corsPreflight() },
  { method: 'GET', path: '/api/dev/tutorial', handler: demoTutorialHandlers.describeTutorial },
  { method: 'POST', path: '/api/dev/tutorial', handler: demoTutorialHandlers.stageTutorial },
  {
    method: 'GET',
    path: '/',
    handler: () => success({
      ok: true,
      service: 'Share Pairs API',
      message: 'The API is running. Open the app at http://localhost:3000.',
    }),
  },
  { method: 'GET', path: '/api/realtime/config', handler: realtimeHandlers.getRealtimeConfig },
  { method: 'POST', path: '/api/auth/register', handler: authHandlers.register },
  { method: 'POST', path: '/api/auth/login', handler: authHandlers.login },
  { method: 'POST', path: '/api/auth/change-password', handler: authHandlers.changePassword },
  { method: 'POST', path: '/api/auth/logout', handler: authHandlers.logout },
  { method: 'POST', path: '/api/auth/verify-email', handler: authHandlers.verifyEmail },
  { method: 'POST', path: '/api/auth/resend-verification', handler: authHandlers.resendVerification },
  { method: 'GET', path: '/api/auth/me', handler: authHandlers.me },
  { method: 'PATCH', path: '/api/auth/me', handler: authHandlers.mePatch },
  { method: 'POST', path: '/api/auth/contacts', handler: authHandlers.addContact },
  { method: 'GET', path: '/api/matches', handler: matchesHandlers.getMatches },
  { method: 'GET', path: '/api/messages', handler: messagesHandlers.getMessages },
  { method: 'POST', path: '/api/messages/send', handler: messagesHandlers.sendMessage },
  { method: 'POST', path: '/api/messages/seen', handler: messagesHandlers.markSeen },
  { method: 'POST', path: '/api/messages/report', handler: messagesHandlers.reportMessage },
  { method: 'GET', path: '/api/assessments', handler: assessmentHandlers.listMine },
  { method: 'GET', path: '/api/assessments/intake', handler: assessmentHandlers.intakeSurvey },
  { method: 'GET', path: '/api/assessments/:id', handler: assessmentHandlers.getOne },
  { method: 'POST', path: '/api/assessments/:id/save', handler: assessmentHandlers.save },
  { method: 'POST', path: '/api/assessments/:id/submit', handler: assessmentHandlers.submit },
  { method: 'POST', path: '/api/consent/request', handler: consentHandlers.consentRequest },
  { method: 'POST', path: '/api/consent/respond', handler: consentHandlers.consentRespond },
  { method: 'GET', path: '/api/conversations', handler: conversationsHandlers.listConversations },
  { method: 'POST', path: '/api/conversations', handler: conversationsHandlers.createConversation },
  { method: 'GET', path: '/api/conversations/support', handler: conversationsHandlers.supportConversation },
  { method: 'POST', path: '/api/conversations/support', handler: conversationsHandlers.supportConversation },
  { method: 'GET', path: '/api/prompts', handler: promptsHandlers.listActivePrompts },
  { method: 'POST', path: '/api/prompts/:id/events', handler: promptsHandlers.recordPromptEvent },
  { method: 'GET', path: '/api/admin/users', handler: adminHandlers.listUsers },
  { method: 'DELETE', path: '/api/admin/users/:uid', handler: adminHandlers.deleteUser },
  { method: 'GET', path: '/api/admin/invites', handler: adminHandlers.listInvitesHandler },
  { method: 'POST', path: '/api/admin/invites', handler: adminHandlers.createInviteHandler },
  { method: 'GET', path: '/api/admin/screeners', handler: adminHandlers.listScreenersHandler },
  { method: 'POST', path: '/api/admin/screeners/access-code', handler: adminHandlers.issueScreenerAccessCode },
  { method: 'GET', path: '/api/admin/conversations', handler: adminHandlers.listAllConversations },
  { method: 'POST', path: '/api/admin/conversations/delete', handler: adminHandlers.deleteConversation },
  { method: 'POST', path: '/api/admin/conversations/moderation', handler: adminHandlers.setConversationModeration },
  { method: 'POST', path: '/api/admin/conversations/monitor', handler: adminHandlers.setConversationMonitor },
  { method: 'POST', path: '/api/admin/conversations/notes', handler: adminHandlers.addConversationNote },
  { method: 'POST', path: '/api/admin/conversations/assign', handler: adminHandlers.assignConversation },
  { method: 'POST', path: '/api/admin/messages/notes', handler: adminHandlers.addMessageNote },
  { method: 'POST', path: '/api/admin/users/notes', handler: adminHandlers.addUserNote },
  { method: 'GET', path: '/api/admin/assessments', handler: assessmentHandlers.adminList },
  { method: 'GET', path: '/api/admin/assessments/instruments', handler: assessmentHandlers.adminInstruments },
  { method: 'GET', path: '/api/admin/assessments/schedule', handler: assessmentHandlers.adminSchedule },
  { method: 'PUT', path: '/api/admin/assessments/schedule', handler: assessmentHandlers.adminSchedule },
  { method: 'POST', path: '/api/admin/assessments/assign', handler: assessmentHandlers.adminAssign },
  { method: 'POST', path: '/api/admin/assessments/cssrs', handler: assessmentHandlers.adminSaveCssrs },
  { method: 'POST', path: '/api/admin/assessments/:id/redcap-retry', handler: assessmentHandlers.adminRedcapRetry },
  { method: 'POST', path: '/api/distress', handler: distressHandlers.submitDistress },
  { method: 'GET', path: '/api/admin/distress', handler: adminHandlers.listUserDistress },
  { method: 'POST', path: '/api/admin/matches', handler: adminHandlers.createMatch },
  { method: 'POST', path: '/api/admin/matches/remove', handler: adminHandlers.removeMatch },
  { method: 'POST', path: '/api/admin/chat/enable', handler: adminHandlers.enableChat },
  { method: 'POST', path: '/api/admin/chat/disable', handler: adminHandlers.disableChat },
  { method: 'GET', path: '/api/admin/prompts', handler: promptsHandlers.listAdminPrompts },
  { method: 'POST', path: '/api/admin/prompts', handler: promptsHandlers.createPrompt },
  { method: 'PUT', path: '/api/admin/prompts/:id', handler: promptsHandlers.updatePrompt },
  { method: 'DELETE', path: '/api/admin/prompts/:id', handler: promptsHandlers.deletePrompt },
];

export async function route(event) {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || null;
  setRequestOrigin(origin);

  if (getMethod(event) === 'OPTIONS') {
    return corsPreflight(origin);
  }

  const path = getPath(event);
  const method = getMethod(event);

  for (const r of routes) {
    if (r.method !== method) continue;
    const params = matchPath(r.path, path);
    if (params == null) continue;
    try {
      const nextEvent = {
        ...event,
        pathParameters: { ...(event.pathParameters || {}), ...params },
      };
      return await r.handler(nextEvent);
    } catch (err) {
      console.error('Handler error:', err);
      return error(err.message || 'Internal server error', 500);
    }
  }

  console.warn('No route match', { method, path, rawPath: event.rawPath, eventPath: event.path });
  return error('Not Found', 404);
}
