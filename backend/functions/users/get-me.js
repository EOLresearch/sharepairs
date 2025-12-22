/**
 * Get current user profile
 * GET /users/me
 */

const { authenticateUser } = require('../../shared/auth');
const { TABLES, getItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');

exports.handler = async (event) => {
  try {
    const user = await authenticateUser(event);
    
    // Get user from DynamoDB
    const userData = await getItem(TABLES.users, { id: user.userId });
    
    if (!userData) {
      return error('User not found', 404);
    }
    
    // Get user profile
    const userProfile = await getItem(TABLES.userProfiles, { user_id: user.userId });
    
    return success({
      id: userData.id,
      email: userData.email,
      displayName: userData.display_name,
      photoUrl: userData.photo_url,
      preferredLanguage: userProfile?.preferred_language || 'en',
      timezone: userProfile?.timezone || 'UTC',
      isAdmin: userData.is_admin || false,
      chatDisabled: userData.chat_disabled || false,
      lastActiveAt: userData.last_active_at,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
      notificationPreferences: userProfile?.notification_preferences || {}
    });
    
  } catch (err) {
    console.error('Get user error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    return error('Failed to get user profile', 500);
  }
};

