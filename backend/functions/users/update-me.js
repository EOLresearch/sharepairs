/**
 * Update current user profile
 * PUT /users/me
 */

const { authenticateUser } = require('../../shared/auth');
const { TABLES, updateItem, getItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');

exports.handler = async (event) => {
  try {
    const user = await authenticateUser(event);
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.updateProfile, body);
    
    if (Object.keys(validatedData).length === 0) {
      return error('No fields to update', 400);
    }
    
    // Update users table if displayName is provided
    if (validatedData.displayName !== undefined) {
      await updateItem(TABLES.users, { id: user.userId }, {
        display_name: validatedData.displayName
      });
    }
    
    // Update user_profiles table
    const profileUpdates = {};
    if (validatedData.preferredLanguage !== undefined) {
      profileUpdates.preferred_language = validatedData.preferredLanguage;
    }
    if (validatedData.timezone !== undefined) {
      profileUpdates.timezone = validatedData.timezone;
    }
    
    if (Object.keys(profileUpdates).length > 0) {
      // Get existing profile or create new one
      const existingProfile = await getItem(TABLES.userProfiles, { user_id: user.userId });
      if (existingProfile) {
        await updateItem(TABLES.userProfiles, { user_id: user.userId }, profileUpdates);
      } else {
        const { putItem } = require('../../shared/database');
        await putItem(TABLES.userProfiles, {
          user_id: user.userId,
          ...profileUpdates,
          created_at: Date.now(),
          updated_at: Date.now()
        });
      }
    }
    
    // Get updated user
    const userData = await getItem(TABLES.users, { id: user.userId });
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
    console.error('Update user error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400);
    }
    
    return error('Failed to update user profile', 500);
  }
};

