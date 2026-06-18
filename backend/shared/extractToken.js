/**
 * Extract auth token from API Gateway / local-server event headers or cookies.
 */
export function extractToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  const headerCookie = event.headers?.Cookie || event.headers?.cookie || '';
  const eventCookies = Array.isArray(event.cookies) ? event.cookies.join('; ') : '';
  const cookieHeader = headerCookie || eventCookies || '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (cookieHeader.includes('authToken=')) {
    const m = cookieHeader.match(/authToken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}
