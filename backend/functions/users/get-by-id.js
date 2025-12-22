/**
 * Get user by ID (public profile)
 * GET /users/{userId}
 */

const { authenticateUser } = require('../../shared/auth');
const { TABLES, getItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');

exports.handler = async (event) => {
  try {
    await authenticateUser(event); // Require auth but don't need to be the same user
    
    const userId = event.pathParameters?.userId;
    
    if (!userId) {
      return error('User ID is required', 400);
    }
    
    // Get public user profile
    const userData = await getItem(TABLES.users, { id: userId });
    
    if (!userData || userData.chat_disabled) {
      return error('User not found', 404);
    }
    
    const userProfile = await getItem(TABLES.userProfiles, { user_id: userId });
    
    return success({
      id: userData.id,
      displayName: userData.display_name,
      photoUrl: userData.photo_url,
      preferredLanguage: userProfile?.preferred_language || 'en'
    });
    
  } catch (err) {
    console.error('Get user by ID error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    return error('Failed to get user', 500);
  }
};

