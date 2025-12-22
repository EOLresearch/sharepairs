/**
 * Login user
 * POST /auth/login
 */

const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { getUserFromToken } = require('../../shared/auth');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');
const auditLogs = require('../../shared/audit');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.login, body);
    
    const { email, password } = validatedData;
    
    // Authenticate with Cognito
    const authCommand = new InitiateAuthCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });
    
    const result = await cognitoClient.send(authCommand);
    
    // Handle new password required challenge
    if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return success({
        challenge: 'NEW_PASSWORD_REQUIRED',
        session: result.Session
      });
    }
    
    // Get user info
    const userInfo = await getUserFromToken(result.AuthenticationResult.AccessToken);
    
    // Update last active timestamp
    const { TABLES, updateItem } = require('../../shared/database');
    try {
      await updateItem(TABLES.users, { id: userInfo.userId }, {
        last_active_at: Date.now()
      });
    } catch (dbError) {
      // Log but don't fail login if DB update fails
      console.warn('Failed to update last_active_at:', dbError);
    }
    
    // Audit log: user login
    const ipAddress = event.requestContext?.identity?.sourceIp || null;
    const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || null;
    try {
      await auditLogs.userLogin(userInfo.userId, ipAddress, userAgent);
    } catch (auditError) {
      // Log but don't fail login if audit logging fails
      console.error('Audit log failed for user login:', auditError);
    }
    
    return success({
      message: 'Login successful',
      user: userInfo,
      tokens: {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400);
    }
    
    if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
      return error('Invalid email or password', 401);
    }
    
    return error('Login failed', 500);
  }
};

