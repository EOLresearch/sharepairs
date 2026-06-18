/**
 * Env-based config. HIPAA-minded: no PHI in logs; use env for secrets.
 */
const env = process.env;

export const config = {
  stage: env.STAGE || 'dev',
  isLocal: env.IS_LOCAL === 'true' || env.AWS_SAM_LOCAL === 'true',

  tables: {
    users: env.USERS_TABLE || 'sharepairs-dev-users',
    conversations: env.CONVERSATIONS_TABLE || 'sharepairs-dev-conversations',
    messages: env.MESSAGES_TABLE || 'sharepairs-dev-messages',
  },

  /** Stub auth for local dev: set STUB_AUTH=true to use email/password in DB instead of Cognito */
  stubAuth: env.STUB_AUTH === 'true',

  /** Allowed CORS origin (default * for dev). In prod set to your frontend origin. */
  corsOrigin: env.CORS_ORIGIN || '*',

  /** Study support UID (used to allow support convo access without mutual consent). */
  supportUid: env.SUPPORT_UID || 'ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1',

  /** API Gateway WebSocket management endpoint (https://{api-id}.execute-api.{region}.amazonaws.com/{stage}) */
  websocketEndpoint: env.WEBSOCKET_API_ENDPOINT || null,

  /** Use in-memory connection map (local dev server). */
  useLocalConnections: env.USE_LOCAL_CONNECTIONS === 'true',
};

export default config;
