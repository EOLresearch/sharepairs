import { getItem } from './database.js';
import { TABLES } from './database.js';
import { config } from './config.js';
import jwt from 'jsonwebtoken';
import { verifyStubToken, toUserData } from './stubAuth.js';

/**
 * Resolve current user from event (Cookie or Authorization header).
 * Returns { userId, email, displayName, isAdmin, userData } or throws.
 */
export async function authenticateUser(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  const cookieHeader = event.headers?.Cookie || event.headers?.cookie || '';
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (config.stubAuth && cookieHeader.includes('authToken=')) {
    const m = cookieHeader.match(/authToken=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }

  if (!token) {
    throw new Error('Missing or invalid Authorization header');
  }

  // Stub auth (local dev)
  if (config.stubAuth && token.startsWith('stub_')) {
    const sub = verifyStubToken(token);
    if (!sub) throw new Error('Invalid or expired token');
    const user = await getItem(TABLES.USERS, { id: sub });
    if (!user) throw new Error('User not found');
    const userData = toUserData(user);
    return {
      userId: sub,
      email: user.email,
      displayName: user.display_name || userData.displayName,
      isAdmin: Boolean(user.is_admin),
      userData,
      ...user,
    };
  }

  // Cognito JWT (production)
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub) {
      throw new Error('Invalid token: missing user ID');
    }
    const userId = decoded.sub;
    const user = await getItem(TABLES.USERS, { id: userId });
    if (!user) throw new Error('User not found');
    const userData = toUserData(user);
    return {
      userId,
      email: user.email,
      displayName: user.display_name,
      isAdmin: user.is_admin || false,
      userData,
      ...user,
    };
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

