import React, { useState } from 'react';

function formatNoteTime(ts) {
  if (ts == null || ts === '') return '';
  if (typeof ts === 'number') {
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toLocaleString();
  }
  if (ts?.seconds != null) return new Date(ts.seconds * 1000).toLocaleString();
  if (ts?._seconds != null) return new Date(ts._seconds * 1000).toLocaleString();
  return '';
}

export default function AdminMemoSection({ notes = [], onSave, notify }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const list = Array.isArray(notes) ? notes : [];

  const save = async () => {
    const text = String(draft || '').trim();
    if (!text) {
      notify?.('Enter a short internal note.', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSave(text);
      setDraft('');
      notify?.('Staff memo saved. Participants cannot see this.', 'success');
    } catch (err) {
      notify?.(err?.message || 'Could not save note.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="drawer-section admin-drawer-memo">
      <h4>Internal memo</h4>
      <p className="muted">Staff handoff only. Participants cannot see this.</p>
      {list.length === 0 ? (
        <p className="muted">No memos yet.</p>
      ) : (
        list.map((n) => (
          <div key={n.id || n.createdAt} className="admin-msg-note">
            <div className="admin-callout-label">
              {n.authorName || 'Admin'} · {formatNoteTime(n.createdAt) || '—'}
            </div>
            <p>{n.body || '—'}</p>
          </div>
        ))
      )}
      <div className="admin-msg-note-form">
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Staff memo (not visible to participants)"
        />
        <div className="admin-msg-note-actions">
          <button type="button" className="admin-btn" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save memo'}
          </button>
        </div>
      </div>
    </section>
  );
}
