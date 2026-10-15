/**
 * Resolve the API root for fetch calls.
 * Study/CloudFront: same-origin "" so /api goes through CloudFront.
 * Local CRA: http://localhost:3001 (from .env.local or default).
 *
 * Never use a baked localhost URL when the page is not on localhost
 * (guards against shipping .env.local into a production build).
 */
export function resolveApiRoot() {
  const baked = String(process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
  const onLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (baked) {
    const isLocalBaked = /localhost|127\.0\.0\.1/.test(baked);
    if (isLocalBaked && !onLocalHost) {
      console.warn(
        '[api] Ignoring localhost REACT_APP_API_URL on a non-local host; using same-origin /api'
      );
      return '';
    }
    return baked;
  }

  if (onLocalHost) return 'http://localhost:3001';
  // CloudFront / study: relative same-origin
  return '';
}
