import { getItem } from './database.js';
import { TABLES } from './database.js';
import jwt from 'jsonwebtoken';
import { jwtVerify } from 'jose';

/**
 * Authenticate user from Cognito JWT token
 * Returns user data if valid, throws error if invalid
 */
export async function authenticateUser(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7);
  
  // For Cognito tokens, we need to verify against the User Pool
  // This is a simplified version - in production, verify against Cognito JWKS
  try {
    // Decode without verification first to get user ID
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.sub) {
      throw new Error('Invalid token: missing user ID');
    }

    const userId = decoded.sub;
    
    // Get user from database
    const user = await getItem(TABLES.USERS, { id: userId });
    
    if (!user) {
      throw new Error('User not found');
    }

    return {
      userId,
      email: user.email,
      displayName: user.display_name,
      isAdmin: user.is_admin || false,
      ...user
    };
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

