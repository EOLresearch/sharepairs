/**
 * Request password reset
 * POST /auth/forgot-password
 */

const { CognitoIdentityProviderClient, ForgotPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.forgotPassword, body);
    
    const { email } = validatedData;
    
    // Request password reset
    const command = new ForgotPasswordCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email
    });
    
    await cognitoClient.send(command);
    
    return success({
      message: 'Password reset code sent to email'
    });
    
  } catch (err) {
    console.error('Forgot password error:', err);
    
    if (err.name === 'UserNotFoundException') {
      return error('User not found', 404);
    }
    
    return error('Failed to send password reset code', 500);
  }
};

