/**
 * Send a message in a conversation
 * POST /conversations/{conversationId}/messages
 */

const { v4: uuidv4 } = require('uuid');
const { authenticateUser } = require('../../shared/auth');
const { TABLES, getItem, putItem, updateItem } = require('../../shared/database');
const { success, error } = require('../../shared/response');
const { schemas, validate } = require('../../shared/validation');
const auditLogs = require('../../shared/audit');

exports.handler = async (event) => {
  try {
    const user = await authenticateUser(event);
    const conversationId = event.pathParameters?.conversationId;
    
    if (!conversationId) {
      return error('Conversation ID is required', 400);
    }
    
    const body = JSON.parse(event.body || '{}');
    const validatedData = validate(schemas.sendMessage, body);
    
    // Verify user is part of conversation
    const conversation = await getItem(TABLES.conversations, { id: conversationId });
    
    if (!conversation || 
        (conversation.user1_id !== user.userId && conversation.user2_id !== user.userId) ||
        conversation.status !== 'active') {
      return error('Conversation not found or inactive', 404);
    }
    
    const messageId = uuidv4();
    const now = Date.now();
    
    // Insert message (write-once - immutable after creation)
    await putItem(TABLES.messages, {
      id: messageId,
      conversation_id: conversationId,
      sender_id: user.userId,
      content: validatedData.content,
      message_type: 'text',
      status: 'sent',
      client_message_id: validatedData.clientMessageId || null,
      created_at: now,
      // Write-once enforcement: no updated_at field, no edit/delete flags
      // Messages are immutable - if moderation needed, use hidden flag
      hidden: false
    });
    
    // Audit log: message sent
    try {
      await auditLogs.messageSent(messageId, conversationId, user.userId);
    } catch (auditError) {
      // Log but don't fail message send if audit logging fails
      console.error('Audit log failed for message send:', auditError);
    }
    
    // Update conversation
    const isUser1 = conversation.user1_id === user.userId;
    const unreadField = isUser1 ? 'user2_unread_count' : 'user1_unread_count';
    const currentUnread = conversation[unreadField] || 0;
    
    await updateItem(TABLES.conversations, { id: conversationId }, {
      last_message_at: now,
      last_message_preview: validatedData.content.substring(0, 100),
      last_sender_id: user.userId,
      [unreadField]: currentUnread + 1
    });
    
    // Get sender info
    const sender = await getItem(TABLES.users, { id: user.userId });
    
    return success({
      id: messageId,
      conversationId,
      senderId: user.userId,
      sender: {
        id: sender?.id,
        displayName: sender?.display_name,
        photoUrl: sender?.photo_url
      },
      content: validatedData.content,
      messageType: 'text',
      status: 'sent',
      clientMessageId: validatedData.clientMessageId,
      createdAt: now
    }, 201);
    
  } catch (err) {
    console.error('Send message error:', err);
    
    if (err.message.includes('authorization') || err.message.includes('token')) {
      return error('Unauthorized', 401);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400);
    }
    
    return error('Failed to send message', 500);
  }
};

