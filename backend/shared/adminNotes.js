/**
 * Shared staff-memo shape for messages, conversations, and participants.
 * Internal only — never attach these to participant API responses.
 */
import crypto from 'crypto';

export const ADMIN_NOTE_MAX_LEN = 2000;

export function shapeAdminNotes(list) {
  if (!Array.isArray(list)) return [];
  return list.map((n) => ({
    id: n.id,
    authorUid: n.authorUid || n.author_uid,
    authorName: n.authorName || n.author_name || '',
    body: n.body || '',
    createdAt: n.createdAt || n.created_at || null,
  }));
}

export function parseAdminNoteText(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    const err = new Error('Note text required');
    err.status = 400;
    throw err;
  }
  if (text.length > ADMIN_NOTE_MAX_LEN) {
    const err = new Error('Note is too long');
    err.status = 400;
    throw err;
  }
  return text;
}

export function appendAdminNote(existing, { authorUid, authorName, body }) {
  const notes = Array.isArray(existing) ? [...existing] : [];
  notes.push({
    id: crypto.randomUUID(),
    authorUid,
    authorName: authorName || 'Admin',
    body,
    createdAt: Date.now(),
  });
  return notes;
}
