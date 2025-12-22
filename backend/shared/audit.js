/**
 * Audit Log Utility
 * 
 * Append-only logging for compliance, IRB, and HIPAA requirements.
 * 
 * IMPORTANT: Audit logs are immutable - once written, they cannot be
 * modified or deleted. This ensures data integrity and compliance.
 */

const { TABLES, putItem } = require('./database');
const { v4: uuidv4 } = require('uuid');

/**
 * Log an audit event
 * 
 * @param {Object} params
 * @param {string} params.eventType - Type of event (e.g., 'user_consent_granted', 'distress_alert', 'admin_action')
 * @param {string} params.action - Action taken (e.g., 'create', 'update', 'delete', 'grant', 'revoke')
 * @param {string} params.actorId - ID of user/admin/system who performed the action
 * @param {string} params.actorType - Type of actor ('user', 'admin', 'system')
 * @param {string} params.resourceType - Type of resource affected (e.g., 'user', 'conversation', 'message')
 * @param {string} params.resourceId - ID of resource affected
 * @param {string} params.userId - ID of user affected (if different from actor)
 * @param {Object} params.metadata - Additional context/metadata
 * @param {string} params.reason - Reason for the action (optional)
 * @param {string} params.ipAddress - IP address of the request (optional)
 * @param {string} params.userAgent - User agent string (optional)
 */
const logEvent = async ({
  eventType,
  action,
  actorId,
  actorType = 'user',
  resourceType,
  resourceId,
  userId = null,
  metadata = {},
  reason = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    const timestamp = Date.now();
    const logEntry = {
      id: uuidv4(),
      timestamp: timestamp,
      event_type: eventType,
      action: action,
      actor_id: actorId,
      actor_type: actorType,
      resource_type: resourceType,
      resource_id: resourceId || null,
      user_id: userId || actorId,  // Default to actor if not specified
      metadata: metadata,
      reason: reason,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: timestamp
    };

    // Remove null/undefined values
    Object.keys(logEntry).forEach(key => {
      if (logEntry[key] === null || logEntry[key] === undefined) {
        delete logEntry[key];
      }
    });

    await putItem(TABLES.auditLogs, logEntry);
    
    console.log('Audit log entry created:', {
      eventType,
      action,
      actorId,
      timestamp: new Date(timestamp).toISOString()
    });

    return logEntry;
  } catch (error) {
    // Audit logging should never fail silently - log to CloudWatch
    console.error('Failed to write audit log:', error);
    // Re-throw to ensure calling code knows logging failed
    throw error;
  }
};

/**
 * Convenience functions for common audit events
 */
const auditLogs = {
  // User consent events
  consentGranted: async (userId, conversationId, actorId, metadata = {}) => {
    return logEvent({
      eventType: 'user_consent_granted',
      action: 'grant',
      actorId,
      actorType: 'user',
      resourceType: 'conversation',
      resourceId: conversationId,
      userId,
      metadata
    });
  },

  consentRevoked: async (userId, conversationId, actorId, metadata = {}) => {
    return logEvent({
      eventType: 'user_consent_revoked',
      action: 'revoke',
      actorId,
      actorType: 'user',
      resourceType: 'conversation',
      resourceId: conversationId,
      userId,
      metadata
    });
  },

  // Distress alerts
  distressAlert: async (userId, level, message, alertedBy, metadata = {}) => {
    return logEvent({
      eventType: 'distress_alert',
      action: 'create',
      actorId: alertedBy,
      actorType: 'admin',
      resourceType: 'user',
      resourceId: userId,
      userId,
      metadata: {
        ...metadata,
        distress_level: level,
        message: message
      }
    });
  },

  // Admin actions
  adminAction: async (action, resourceType, resourceId, adminId, reason = null, metadata = {}) => {
    return logEvent({
      eventType: 'admin_action',
      action,
      actorId: adminId,
      actorType: 'admin',
      resourceType,
      resourceId,
      metadata,
      reason
    });
  },

  // Auth events
  userLogin: async (userId, ipAddress = null, userAgent = null) => {
    return logEvent({
      eventType: 'user_login',
      action: 'login',
      actorId: userId,
      actorType: 'user',
      resourceType: 'user',
      resourceId: userId,
      userId,
      ipAddress,
      userAgent
    });
  },

  userRegistered: async (userId, email, ipAddress = null) => {
    return logEvent({
      eventType: 'user_registered',
      action: 'create',
      actorId: userId,
      actorType: 'user',
      resourceType: 'user',
      resourceId: userId,
      userId,
      metadata: { email },
      ipAddress
    });
  },

  userDisabled: async (userId, adminId, reason = null) => {
    return logEvent({
      eventType: 'user_disabled',
      action: 'update',
      actorId: adminId,
      actorType: 'admin',
      resourceType: 'user',
      resourceId: userId,
      userId,
      reason
    });
  },

  userSuspended: async (userId, adminId, reason = null, duration = null) => {
    return logEvent({
      eventType: 'user_suspended',
      action: 'update',
      actorId: adminId,
      actorType: 'admin',
      resourceType: 'user',
      resourceId: userId,
      userId,
      metadata: { duration },
      reason
    });
  },

  // Message events (for tracking, not modification)
  messageSent: async (messageId, conversationId, senderId) => {
    return logEvent({
      eventType: 'message_sent',
      action: 'create',
      actorId: senderId,
      actorType: 'user',
      resourceType: 'message',
      resourceId: messageId,
      userId: senderId,
      metadata: { conversation_id: conversationId }
    });
  },

  // Generic log function
  log: logEvent
};

module.exports = auditLogs;

