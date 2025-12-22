/**
 * Register new user
 * POST /auth/register
 */

const { CognitoIdentityProviderClient, SignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { TABLES, putItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.register, body);
    
    const { email, password, displayName, preferredLanguage, timezone } = validatedData;
    
    // Register user with Cognito
    const signUpCommand = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'custom:display_name', Value: displayName },
        { Name: 'custom:preferred_language', Value: preferredLanguage },
        { Name: 'custom:timezone', Value: timezone }
      ]
    });
    
    const result = await cognitoClient.send(signUpCommand);
    const now = Date.now();
    
    // Create user in DynamoDB
    await putItem(TABLES.users, {
      id: result.UserSub,
      email: email,
      display_name: displayName,
      email_verified: false,
      is_admin: false,
      chat_disabled: false,
      created_at: now,
      updated_at: now
    });
    
    // Create user profile
    await putItem(TABLES.userProfiles, {
      user_id: result.UserSub,
      preferred_language: preferredLanguage,
      timezone: timezone,
      created_at: now,
      updated_at: now
    });
    
    return success({
      message: 'User registered successfully',
      userSub: result.UserSub,
      needsConfirmation: !result.UserConfirmed
    }, 201);
    
  } catch (err) {
    console.error('Registration error:', err);
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400);
    }
    
    if (err.name === 'UsernameExistsException') {
      return error('User already exists', 409);
    }
    
    return error('Registration failed', 500);
  }
};

