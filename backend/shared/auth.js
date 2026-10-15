import { getItem } from './database.js';
import { TABLES } from './database.js';
import { config } from './config.js';
import jwt from 'jsonwebtoken';
import { verifyStubToken, toUserData } from './stubAuth.js';
import { isInviteRecord } from './invites.js';
import { extractToken } from './extractToken.js';

/**
 * Resolve user from a raw token string (stub or Cognito JWT).
 */
export async function authenticateToken(token) {
  if (!token) {
    throw new Error('Missing or invalid token');
  }

  if (config.stubAuth) {
    if (!token.startsWith('stub_')) {
      throw new Error('Invalid token');
    }
    const sub = verifyStubToken(token);
    if (!sub) throw new Error('Invalid or expired token');
    const user = await getItem(TABLES.USERS, { id: sub });
    if (!user || isInviteRecord(user)) throw new Error('User not found');
    const userData = toUserData(user);
    return {
      userId: sub,
      email: user.email,
      displayName: user.display_name || userData?.displayName,
      isAdmin: Boolean(user.is_admin),
      userData,
      ...user,
    };
  }

  // Cognito JWT — only when STUB_AUTH is off. Never decode unverified tokens in stub mode.
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

/**
 * Resolve current user from event (Cookie or Authorization header).
 * Returns { userId, email, displayName, isAdmin, userData } or throws.
 */
export async function authenticateUser(event) {
  const queryToken = event.queryStringParameters?.token;
  const token = queryToken || extractToken(event);
  if (!token) {
    throw new Error('Missing or invalid Authorization header');
  }
  return authenticateToken(token);
}

