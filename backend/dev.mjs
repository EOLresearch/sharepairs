/**
 * Bootstrap local API against DynamoDB (persists across restarts).
 * Offline/in-memory: MEMORY_DB=true npm run dev:memory
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] == null) process.env[key] = val;
  }
}

process.env.STUB_AUTH ??= 'true';
process.env.USE_LOCAL_CONNECTIONS = 'true';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
process.env.STUB_AUTH_SECRET ??= 'dev-secret-local';
process.env.AWS_REGION ??= 'us-east-1';
process.env.STAGE ??= 'local';
process.env.USERS_TABLE ??= 'sharepairs-dev-users';
process.env.CONVERSATIONS_TABLE ??= 'sharepairs-dev-conversations';
process.env.MESSAGES_TABLE ??= 'sharepairs-dev-messages';
process.env.DISTRESS_EVENTS_TABLE ??= 'sharepairs-dev-distress-events';
process.env.PROMPTS_TABLE ??= 'sharepairs-dev-prompts';
process.env.ASSESSMENTS_TABLE ??= 'sharepairs-dev-assessments';

// Default local tooling to in-memory store (SIMPATICO_ENV=local).
// Override: MEMORY_DB=false npm run dev  (still local, but Dynamo in your AWS account)
if (process.env.MEMORY_DB == null) process.env.MEMORY_DB = 'true';
if (process.env.MEMORY_DB === 'true') process.env.SIMPATICO_ENV ??= 'local';
process.env.SIMPATICO_ENV ??= 'local';
process.env.REQUIRE_EMAIL_VERIFICATION ??= 'false';

console.log(
  `Local API boot: env=${process.env.SIMPATICO_ENV} MEMORY_DB=${process.env.MEMORY_DB} region=${process.env.AWS_REGION}`
);

await import('./local-server.mjs');
