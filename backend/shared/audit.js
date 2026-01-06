import { putItem } from './database.js';
import { TABLES } from './database.js';
import crypto from 'crypto';

/**
 * Audit logging utility for HIPAA compliance
 * All audit logs are append-only (write-once)
 */

/**
 * Log an audit event
 * @param {string} eventType - Type of event (e.g., 'file_upload_requested', 'file_download_requested')
 * @param {string} userId - User ID who performed the action
 * @param {object} metadata - Additional event metadata
 */
export async function logEvent(eventType, userId, metadata = {}) {
  const timestamp = Date.now();
  const id = crypto.randomUUID();

  const auditLog = {
    id,
    timestamp,
    event_type: eventType,
    user_id: userId,
    ...metadata
  };

  try {
    await putItem(TABLES.AUDIT_LOGS, auditLog);
    return auditLog;
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw - audit logging failure shouldn't break the main flow
    // but we should log it for monitoring
    return null;
  }
}

/**
 * Convenience functions for common audit events
 */
export const auditEvents = {
  fileUploadRequested: (userId, fileKey, fileName, contentType) =>
    logEvent('file_upload_requested', userId, {
      file_key: fileKey,
      file_name: fileName,
      content_type: contentType
    }),

  fileDownloadRequested: (userId, fileId, fileKey) =>
    logEvent('file_download_requested', userId, {
      file_id: fileId,
      file_key: fileKey
    }),

  fileUploaded: (userId, fileKey, fileSize) =>
    logEvent('file_uploaded', userId, {
      file_key: fileKey,
      file_size: fileSize
    }),

  fileDeleted: (userId, fileKey) =>
    logEvent('file_deleted', userId, {
      file_key: fileKey
    }),

  distressSubmitted: (userId, eventId, score, queued) =>
    logEvent('distress_submitted', userId, {
      event_id: eventId,
      score: score,
      queued: queued
    }),

  distressEmailSent: (userId, eventId, messageId) =>
    logEvent('distress_email_sent', userId, {
      event_id: eventId,
      email_message_id: messageId
    })
};

