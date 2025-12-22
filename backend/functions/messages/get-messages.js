/**
 * Get messages for a conversation
 * GET /conversations/{conversationId}/messages
 */

const { authenticateUser } = require('../../shared/auth');
const { TABLES, getItem, query: dynamoQuery, updateItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');

exports.handler = async (event) => {
  try {
    const user = await authenticateUser(event);
    const conversationId = event.pathParameters?.conversationId;
    
    if (!conversationId) {
      return error('Conversation ID is required', 400);
    }
    
    // Verify user is part of conversation
    const conversation = await getItem(TABLES.conversations, { id: conversationId });
    
    if (!conversation || (conversation.user1_id !== user.userId && conversation.user2_id !== user.userId)) {
      return error('Conversation not found', 404);
    }
    
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const cursor = event.queryStringParameters?.cursor ? JSON.parse(Buffer.from(event.queryStringParameters.cursor, 'base64').toString()) : null;
    const before = event.queryStringParameters?.before ? parseInt(event.queryStringParameters.before) : null;
    
    // Query messages for this conversation
    const keyCondition = {
      expression: 'conversation_id = :convId',
      names: {},
      values: { ':convId': conversationId }
    };
    
    if (before || cursor?.created_at) {
      keyCondition.expression += ' AND created_at < :before';
      keyCondition.values[':before'] = before || cursor.created_at;
    }
    
    const messagesResult = await dynamoQuery(TABLES.messages, keyCondition, {
      limit: Math.min(limit, 100),
      scanForward: false, // Descending order
      cursor: cursor
    });
    
    // Get sender info for each message
    const messages = await Promise.all(
      messagesResult.items.map(async (msg) => {
        const sender = await getItem(TABLES.users, { id: msg.sender_id });
        return {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          sender: {
            id: sender?.id,
            displayName: sender?.display_name,
            photoUrl: sender?.photo_url
          },
          content: msg.content,
          messageType: msg.message_type,
          status: msg.status,
          clientMessageId: msg.client_message_id,
          createdAt: msg.created_at
        };
      })
    );
    
    // Reverse to get chronological order (oldest first)
    messages.reverse();
    
    // Mark messages as read
    const isUser1 = conversation.user1_id === user.userId;
    await updateItem(TABLES.conversations, { id: conversationId }, {
      [isUser1 ? 'user1_unread_count' : 'user2_unread_count']: 0
    });
    
    const nextCursor = messagesResult.cursor 
      ? Buffer.from(JSON.stringify(messagesResult.cursor)).toString('base64')
      : null;
    
    return success({
      messages,
      cursor: nextCursor
    });
    
  } catch (err) {
    console.error('Get messages error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    return error('Failed to get messages', 500);
  }
};

