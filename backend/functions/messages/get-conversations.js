/**
 * Get user's conversations
 * GET /conversations
 */

const { authenticateUser } = require('../../shared/auth');
const { TABLES, query: dynamoQuery, getItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');

exports.handler = async (event) => {
  try {
    const user = await authenticateUser(event);
    
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const cursor = event.queryStringParameters?.cursor ? JSON.parse(Buffer.from(event.queryStringParameters.cursor, 'base64').toString()) : null;
    
    // Query conversations where user is user1
    const user1Result = await dynamoQuery(TABLES.conversations, {
      expression: 'user1_id = :userId',
      names: {},
      values: { ':userId': user.userId }
    }, {
      indexName: 'user1-index',
      limit: Math.min(limit, 100),
      scanForward: false, // Descending by last_message_at
      cursor: cursor?.user1
    });
    
    // Query conversations where user is user2
    const user2Result = await dynamoQuery(TABLES.conversations, {
      expression: 'user2_id = :userId',
      names: {},
      values: { ':userId': user.userId }
    }, {
      indexName: 'user2-index',
      limit: Math.min(limit, 100),
      scanForward: false,
      cursor: cursor?.user2
    });
    
    // Combine and filter active conversations
    const allConversations = [
      ...user1Result.items.filter(c => c.status === 'active'),
      ...user2Result.items.filter(c => c.status === 'active')
    ];
    
    // Sort by last_message_at descending
    allConversations.sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
    
    // Limit results
    const conversations = allConversations.slice(0, limit);
    
    // Get other user details for each conversation
    const conversationsWithUsers = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.user1_id === user.userId ? conv.user2_id : conv.user1_id;
        const unreadCount = conv.user1_id === user.userId ? (conv.user2_unread_count || 0) : (conv.user1_unread_count || 0);
        
        const otherUser = await getItem(TABLES.users, { id: otherUserId });
        const otherUserProfile = await getItem(TABLES.userProfiles, { user_id: otherUserId });
        
        return {
          id: conv.id,
          userId1: conv.user1_id,
          userId2: conv.user2_id,
          otherUser: {
            id: otherUser?.id,
            displayName: otherUser?.display_name,
            preferredLanguage: otherUserProfile?.preferred_language || 'en'
          },
          lastMessageAt: conv.last_message_at,
          unreadCount: unreadCount,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at
        };
      })
    );
    
    // Get next cursor
    const nextCursor = conversations.length === limit 
      ? Buffer.from(JSON.stringify({ user1: user1Result.cursor, user2: user2Result.cursor })).toString('base64')
      : null;
    
    return success({
      conversations: conversationsWithUsers,
      cursor: nextCursor
    });
    
  } catch (err) {
    console.error('Get conversations error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    return error('Failed to get conversations', 500);
  }
};

