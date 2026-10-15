/**
 * Share Pairs environment labels:
 *   local  — Mac / MEMORY_DB (or local Dynamo). Easy auth for coding.
 *   study  — Radiology CloudFront + live DynamoDB (CloudShell deploy).
 */
const raw = String(process.env.SIMPATICO_ENV || '').toLowerCase().trim();

export function getSimpaticoEnv() {
  if (raw === 'local' || raw === 'study') return raw;
  // Infer: in-memory API is always local
  if (process.env.MEMORY_DB === 'true') return 'local';
  // Explicit local flag
  if (process.env.IS_LOCAL === 'true' || process.env.USE_LOCAL_CONNECTIONS === 'true') {
    // Local API server against Dynamo still counts as local tooling
    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) return 'local';
  }
  return 'study';
}

export function isLocalEnv() {
  return getSimpaticoEnv() === 'local';
}

/** Local identities: "user1" → "user1@local" for storage / lookup */
export function normalizeAuthIdentity(emailOrUser) {
  const rawId = String(emailOrUser || '').trim().toLowerCase();
  if (!rawId) return '';
  if (!isLocalEnv()) return rawId;
  if (rawId.includes('@')) return rawId;
  return `${rawId}@local`;
}
