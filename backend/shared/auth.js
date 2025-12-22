/**
 * Authentication utilities for Cognito
 * Validates JWT tokens and extracts user information
 */

const { CognitoIdentityProviderClient, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Get user info from Cognito access token
 */
const getUserFromToken = async (accessToken) => {
  try {
    const command = new GetUserCommand({ AccessToken: accessToken });
    const response = await cognitoClient.send(command);
    
    const userAttributes = {};
    response.UserAttributes.forEach(attr => {
      userAttributes[attr.Name] = attr.Value;
    });
    
    return {
      userId: userAttributes.sub,
      email: userAttributes.email,
      emailVerified: userAttributes.email_verified === 'true',
      displayName: userAttributes['custom:display_name'] || userAttributes.email?.split('@')[0],
      preferredLanguage: userAttributes['custom:preferred_language'] || 'en',
      timezone: userAttributes['custom:timezone'] || 'UTC',
      isAdmin: userAttributes['custom:is_admin'] === 'true'
    };
  } catch (error) {
    console.error('Cognito getUser error:', error);
    throw new Error('Invalid or expired token');
  }
};

/**
 * Authenticate user from Authorization header
 * Returns user info if valid, throws error if invalid
 */
const authenticateUser = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No authorization header found');
    }

    const accessToken = authHeader.substring(7);
    const userInfo = await getUserFromToken(accessToken);
    
    // Verify user exists in database and is active
    const { TABLES, getItem } = require('./database');
    const user = await getItem(TABLES.users, { id: userInfo.userId });

    if (!user) {
      throw new Error('User not found in database');
    }
    
    if (user.chat_disabled) {
      throw new Error('User account is disabled');
    }

    return {
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      isAdmin: user.is_admin || false
    };
  } catch (error) {
    console.error('Authentication failed:', error.message);
    throw error;
  }
};

/**
 * Require admin access - throws error if user is not admin
 */
const requireAdmin = async (event) => {
  const user = await authenticateUser(event);
  
  if (!user.isAdmin) {
    throw new Error('Admin access required');
  }
  
  return user;
};

module.exports = {
  getUserFromToken,
  authenticateUser,
  requireAdmin
};

