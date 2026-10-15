/**
 * Frontend env label: local (localhost) vs study (CloudFront / deployed).
 * Mirrors backend SIMPATICO_ENV.
 */
export function isLocalApp() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function getSimpaticoEnvLabel() {
  return isLocalApp() ? 'local' : 'study';
}
