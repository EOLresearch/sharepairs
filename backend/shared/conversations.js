import { getItem, TABLES } from './database.js';
import { config } from './config.js';
import { shapeAdminNotes } from './adminNotes.js';

export function monitorFields(row = {}) {
  return {
    pinned: Boolean(row.pinned),
    needsReview: Boolean(row.needs_review),
    highPriority: Boolean(row.high_priority),
    reportCount: Number(row.report_count || 0),
    lastReportAt: row.last_report_at || null,
  };
}

export function toConvoShape(row, { includeAdminNotes = false } = {}) {
  if (!row) return null;
  const shape = {
    docID: row.id,
    cid: row.id,
    users: row.users,
    requester: row.requester,
    recipient: row.recipient,
    type: row.type || null,
    consentBy: row.consent_by,
    consentGivenBy: row.consent_by,
    mutualConsent: Boolean(row.mutual_consent),
    isClosed: Boolean(row.is_closed),
    moderationStatus:
      row.moderation_status === 'paused' || row.moderation_status === 'terminated'
        ? row.moderation_status
        : 'active',
    ...monitorFields(row),
    hasUnreadBy: row.has_unread_by || [],
    lastMsgAt: row.last_msg_at,
    lastMsgPreview: row.last_msg_preview,
    lastSenderId: row.last_sender_id,
    interventionStartAt: row.intervention_start_at || null,
    seenBy: row.seen_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeAdminNotes) {
    shape.adminNotes = shapeAdminNotes(row.admin_notes);
    shape.assignedToUid = row.assigned_to_uid || null;
    shape.assignedToName = row.assigned_to_name || '';
    shape.assignedAt = row.assigned_at || null;
    shape.assignedByUid = row.assigned_by_uid || null;
    shape.assignedByName = row.assigned_by_name || '';
  }
  return shape;
}

function otherUidInConvo(row, viewerUid) {
  const viewer = String(viewerUid || '');
  const users = Array.isArray(row?.users) ? row.users.map(String) : [];
  return users.find((id) => id && id !== viewer) || null;
}

export async function namesForUserIds(ids) {
  const map = {};
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  const supportUid = String(config.supportUid || '');
  for (const id of unique) {
    if (supportUid && id === supportUid) {
      map[id] = 'Study Support';
      continue;
    }
    const user = await getItem(TABLES.USERS, { id });
    const name = String(user?.display_name || user?.displayName || '').trim();
    map[id] = name || String(user?.email || '').trim();
  }
  return map;
}

/** Attach the other participant's display name for the signed-in viewer. */
export async function enrichConvosForViewer(rows, viewerUid) {
  const otherIds = (rows || []).map((row) => otherUidInConvo(row, viewerUid)).filter(Boolean);
  const names = await namesForUserIds(otherIds);
  return (rows || [])
    .map((row) => {
      const shape = toConvoShape(row);
      if (!shape) return null;
      const otherUserUid = otherUidInConvo(row, viewerUid);
      return {
        ...shape,
        otherUserUid,
        otherDisplayName: (otherUserUid && names[otherUserUid]) || '',
      };
    })
    .filter(Boolean);
}

export async function notifyConversationUpdate(userIds, conversation) {
  const { broadcastToUsers } = await import('./broadcast.js');
  const shape = toConvoShape(conversation);
  await broadcastToUsers(userIds, {
    type: 'conversationUpdate',
    payload: { conversation: shape, timestamp: Date.now() },
  });
}
