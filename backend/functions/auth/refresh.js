/**
 * Refresh access token
 * POST /auth/refresh
 */

const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.refreshToken, body);
    
    const { refreshToken } = validatedData;
    
    // Refresh token with Cognito
    const authCommand = new InitiateAuthCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    });
    
    const result = await cognitoClient.send(authCommand);
    
    return success({
      tokens: {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn
      }
    });
    
  } catch (err) {
    console.error('Token refresh error:', err);
    
    if (err.name === 'NotAuthorizedException') {
      return error('Invalid or expired refresh token', 401);
    }
    
    return error('Token refresh failed', 500);
  }
};

