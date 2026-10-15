import crypto from 'crypto';
import { getItem, updateItem, TABLES } from './database.js';
import { sendFlaggedConversationEmail } from './studyNotify.js';
import { notifyConversationUpdate } from './conversations.js';
import { shapeAdminNotes } from './adminNotes.js';

/** Staff fields (reports, memos) only when an admin is not a participant in the thread. */
export function includeStaffMessageFields({ isAdmin = false, viewerUid = null, participantUids = [] } = {}) {
  if (!isAdmin) return false;
  const viewer = String(viewerUid || '');
  if (!viewer) return true;
  return !(participantUids || []).map(String).includes(viewer);
}

export function toMessageShape(m, { isAdmin = false, viewerUid = null } = {}) {
  if (!m) return null;
  const reports = Array.isArray(m.reports) ? m.reports : [];
  const notes = Array.isArray(m.admin_notes) ? m.admin_notes : [];
  const shape = {
    id: m.message_id,
    mid: m.message_id,
    body: m.body,
    sentFromUid: m.sent_from_uid,
    sentFromDisplayName: m.sent_from_display_name || '',
    status: m.status || 'sent',
    clientId: m.client_id,
    createdAt: m.created_at ? { seconds: Math.floor(m.created_at / 1000) } : null,
    reportedByMe: Boolean(
      viewerUid && reports.some((r) => r.reporterUid === viewerUid || r.reporter_uid === viewerUid)
    ),
  };
  if (isAdmin) {
    shape.reports = reports.map((r) => ({
      id: r.id,
      reporterUid: r.reporterUid || r.reporter_uid,
      reporterName: r.reporterName || r.reporter_name || '',
      explanation: r.explanation || '',
      createdAt: r.createdAt || r.created_at || null,
    }));
    shape.adminNotes = shapeAdminNotes(notes);
  }
  return shape;
}

export async function flagConversationForReview(convo, {
  highPriority = true,
  reason = 'participant_report',
  reporterLabel,
  explanation,
  messagePreview,
  incrementReport = false,
} = {}) {
  if (!convo?.id) return convo;
  const now = Date.now();
  const updates = {
    needs_review: true,
    high_priority: highPriority || Boolean(convo.high_priority),
    updated_at: now,
  };
  if (incrementReport) {
    updates.report_count = Number(convo.report_count || 0) + 1;
    updates.last_report_at = now;
  }
  await updateItem(TABLES.CONVERSATIONS, { id: convo.id }, updates);
  const updated = await getItem(TABLES.CONVERSATIONS, { id: convo.id });
  try {
    await notifyConversationUpdate(updated.users || convo.users || [], updated);
  } catch (err) {
    console.warn('[flagConversation] notify failed:', err?.message || err);
  }
  try {
    const labels = [];
    for (const uid of updated.users || []) {
      const u = await getItem(TABLES.USERS, { id: uid });
      labels.push(u?.display_name || u?.displayName || u?.email || uid);
    }
    await sendFlaggedConversationEmail({
      conversationId: convo.id,
      reason,
      priority: updates.high_priority ? 'high' : 'review',
      reporterLabel,
      explanation,
      messagePreview,
      participantLabels: labels,
    });
  } catch (err) {
    console.warn('[flagConversation] email failed:', err?.message || err);
  }
  return updated;
}

export function newId() {
  return crypto.randomUUID();
}
