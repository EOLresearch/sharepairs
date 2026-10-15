/**
 * Local dev server: REST API + WebSocket on port 3001.
 * Prefer: npm run dev  (DynamoDB by default)
 * Ephemeral: MEMORY_DB=true npm run dev
 */
import http from 'http';
import { WebSocketServer } from 'ws';
import { route } from './functions/api/router.js';
import { authenticateToken } from './shared/auth.js';
import {
  registerLocalConnection,
  unregisterLocalConnection,
} from './shared/localConnections.js';
import { seedLocalMemoryUsers } from './shared/localSeed.js';
import { getSimpaticoEnv } from './shared/env.js';
import { processAssessmentReminders } from './shared/assessments/service.js';

const PORT = Number(process.env.PORT || 3001);
const STUB_AUTH = process.env.STUB_AUTH !== 'false';
process.env.STUB_AUTH = STUB_AUTH ? 'true' : 'false';
process.env.USE_LOCAL_CONNECTIONS = 'true';
if (process.env.MEMORY_DB === 'true') {
  process.env.SIMPATICO_ENV ??= 'local';
}

async function seedMemoryUsers() {
  await seedLocalMemoryUsers();
}

function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  });
  return out;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function toLambdaEvent(req, body, url) {
  const cookies = parseCookies(req.headers.cookie || '');
  const cookiePairs = Object.entries(cookies).map(([k, v]) => `${k}=${v}`);
  return {
    rawPath: url.pathname,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: { ...req.headers, cookie: req.headers.cookie || '' },
    cookies: cookiePairs,
    body: body || null,
    requestContext: {
      http: { method: req.method, path: url.pathname },
      stage: 'local',
    },
  };
}

function sendLambdaResponse(res, lambdaRes) {
  const headers = lambdaRes.headers || {};
  Object.entries(headers).forEach(([k, v]) => {
    if (v != null) res.setHeader(k, v);
  });
  res.statusCode = lambdaRes.statusCode || 200;
  res.end(lambdaRes.body ?? '');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:3000',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
    });
    res.end();
    return;
  }

  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? null : await readBody(req);
    const event = toLambdaEvent(req, body, url);
    const lambdaRes = await route(event);
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.CORS_ORIGIN || 'http://localhost:3000'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    sendLambdaResponse(res, lambdaRes);
  } catch (err) {
    console.error('HTTP error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');

  const sendJson = (obj) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  };

  if (token) {
    try {
      const auth = await authenticateToken(token);
      registerLocalConnection(ws, auth.userId);
      sendJson({ type: 'authOk', payload: { userId: auth.userId } });
    } catch {
      ws.close(4001, 'Unauthorized');
      return;
    }
  }

  ws.on('message', async (raw) => {
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      sendJson({ type: 'error', payload: { message: 'Invalid JSON' } });
      return;
    }

    const type = data.type || 'message';
    const payload = data.payload ?? data;

    if (type === 'ping') {
      sendJson({ type: 'pong' });
      return;
    }

    if (type === 'auth' && payload.token) {
      try {
        const auth = await authenticateToken(payload.token);
        registerLocalConnection(ws, auth.userId);
        sendJson({ type: 'authOk', payload: { userId: auth.userId } });
      } catch {
        sendJson({ type: 'error', payload: { message: 'Unauthorized' } });
      }
    }
  });

  ws.on('close', () => unregisterLocalConnection(ws));
  ws.on('error', () => unregisterLocalConnection(ws));
});

await seedMemoryUsers();

const REMINDER_MS = Number(process.env.ASSESSMENT_REMINDER_TICK_MS || 5 * 60 * 1000);
setInterval(() => {
  processAssessmentReminders().catch((err) => {
    console.warn('[assessments] reminder tick failed:', err?.message || err);
  });
}, REMINDER_MS);

server.listen(PORT, () => {
  console.log(`Share Pairs env=${getSimpaticoEnv()}  http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`STUB_AUTH=${process.env.STUB_AUTH} MEMORY_DB=${process.env.MEMORY_DB}`);
});
