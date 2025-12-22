/**
 * Reset password with code
 * POST /auth/reset-password
 */

const { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.resetPassword, body);
    
    const { email, code, newPassword } = validatedData;
    
    // Confirm password reset
    const command = new ConfirmForgotPasswordCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword
    });
    
    await cognitoClient.send(command);
    
    return success({
      message: 'Password reset successful'
    });
    
  } catch (err) {
    console.error('Reset password error:', err);
    
    if (err.name === 'CodeMismatchException') {
      return error('Invalid verification code', 400);
    }
    
    if (err.name === 'ExpiredCodeException') {
      return error('Verification code has expired', 400);
    }
    
    return error('Password reset failed', 500);
  }
};

