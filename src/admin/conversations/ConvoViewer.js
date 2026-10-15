import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getMessages, fetchOlderMessages } from '../../services/messageService';
import { addMessageNote } from '../actions/adminActions';

const DEFAULT_PAGE_SIZE = 80;
const POLL_MS = 5000;

const toLocal = (ts) => {
  if (ts == null || ts === '') return '';
  if (typeof ts === 'number') {
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toLocaleString();
  }
  if (ts?.toDate?.().toLocaleString) return ts.toDate().toLocaleString();
  if (ts?.seconds != null) return new Date(ts.seconds * 1000).toLocaleString();
  if (ts?._seconds != null) return new Date(ts._seconds * 1000).toLocaleString();
  return '';
};

const msgTime = (m) => {
  const v = m?.createdAt;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  if (v?.seconds != null) return v.seconds * 1000;
  if (v?._seconds != null) return v._seconds * 1000;
  return 0;
};

const msgId = (m) => m?.mid || m?.id;

const preview = (text, n = 90) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '[no text]';
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

export default function ConvoViewer({
  convoId,
  participants = [],
  usersById = {},
  onClose,
  pageSize = DEFAULT_PAGE_SIZE,
  notify,
}) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [oldestCursor, setOldestCursor] = useState(null);
  const [reachedBeginning, setReachedBeginning] = useState(false);
  const [view, setView] = useState('all');
  const [noteOpenId, setNoteOpenId] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [noteSaving, setNoteSaving] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const pollRef = useRef(null);
  const bodyRef = useRef(null);

  const title = useMemo(() => {
    const names = (participants || []).map(
      (uid) => usersById[uid]?.displayName || usersById[uid]?.email || uid
    );
    return names.length ? names.join(' ↔ ') : convoId || 'Conversation';
  }, [participants, usersById, convoId]);

  const load = useCallback(async () => {
    if (!convoId) return;
    try {
      const list = await getMessages(convoId);
      const msgs = Array.isArray(list) ? list : [];
      const asc = [...msgs].sort((a, b) => msgTime(a) - msgTime(b));
      setMessages(asc);
      setOldestCursor(asc.length ? msgId(asc[0]) : null);
      setReachedBeginning(asc.length < pageSize);
    } catch (err) {
      console.error('ConvoViewer load failed:', err);
      notify?.(err?.message || 'Failed to load messages.', 'error');
    } finally {
      setInitialLoading(false);
    }
  }, [convoId, pageSize, notify]);

  useEffect(() => {
    setInitialLoading(true);
    setMessages([]);
    setOldestCursor(null);
    setReachedBeginning(false);
    setNoteOpenId(null);
    setFocusId(null);
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    if (initialLoading) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [initialLoading, convoId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadOlder = useCallback(async () => {
    if (!convoId || !oldestCursor || olderLoading || reachedBeginning) return;
    setOlderLoading(true);
    try {
      const { messages: olderMessages, lastDoc, hasMore } = await fetchOlderMessages(
        convoId,
        oldestCursor
      );
      const olderAsc = Array.isArray(olderMessages)
        ? [...olderMessages].sort((a, b) => msgTime(a) - msgTime(b))
        : [];
      setMessages((curr) => {
        const seen = new Set(curr.map((m) => msgId(m)));
        const fresh = olderAsc.filter((m) => !seen.has(msgId(m)));
        return [...fresh, ...curr];
      });
      setOldestCursor(lastDoc || oldestCursor);
      if (!hasMore) setReachedBeginning(true);
    } catch (err) {
      console.error('ConvoViewer loadOlder failed:', err);
      notify?.('Failed to load older messages.', 'error');
    } finally {
      setOlderLoading(false);
    }
  }, [convoId, oldestCursor, olderLoading, reachedBeginning, notify]);

  const senderLabel = (m) => {
    const uid = m.sentFromUid || m.uid || m.senderUid;
    return (
      m.sentFromDisplayName ||
      usersById[uid]?.displayName ||
      usersById[uid]?.email ||
      uid ||
      'Unknown'
    );
  };

  const reportedMessages = useMemo(
    () => messages.filter((m) => (m.reports || []).length > 0),
    [messages]
  );

  const visible = view === 'reported' ? reportedMessages : messages;

  const jumpTo = (id) => {
    setView('all');
    setFocusId(id);
    requestAnimationFrame(() => {
      document.getElementById(`admin-msg-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const saveNote = async (m) => {
    const id = msgId(m);
    const text = String(noteDrafts[id] || '').trim();
    if (!text) {
      notify?.('Enter a short internal note.', 'error');
      return;
    }
    setNoteSaving(id);
    try {
      const result = await addMessageNote(convoId, id, text);
      const updated = result?.message;
      if (updated) {
        setMessages((prev) =>
          prev.map((row) => (msgId(row) === id ? { ...row, ...updated } : row))
        );
      }
      setNoteDrafts((prev) => ({ ...prev, [id]: '' }));
      notify?.('Staff memo saved. Participants cannot see this.', 'success');
    } catch (err) {
      notify?.(err?.message || 'Could not save note.', 'error');
    } finally {
      setNoteSaving(null);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-modal admin-msg-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Message viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-modal-header">
          <div>
            <h3>{title}</h3>
            <p className="muted">Staff view — participants do not see notes</p>
          </div>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="admin-modal-body" ref={bodyRef}>
          {initialLoading ? (
            <div className="muted pad">Loading messages…</div>
          ) : (
            <>
              <div className="admin-modal-toolbar">
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={loadOlder}
                  disabled={olderLoading || reachedBeginning}
                >
                  {reachedBeginning
                    ? 'Oldest messages'
                    : olderLoading
                      ? 'Loading…'
                      : 'Load older'}
                </button>
                <div className="admin-view-toggle" role="group" aria-label="Message filter">
                  <button
                    type="button"
                    className={view === 'all' ? 'is-active' : ''}
                    onClick={() => setView('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={view === 'reported' ? 'is-active' : ''}
                    onClick={() => setView('reported')}
                    disabled={!reportedMessages.length}
                  >
                    Reported ({reportedMessages.length})
                  </button>
                </div>
              </div>

              {reportedMessages.length > 0 && view === 'all' && (
                <div className="admin-report-jump">
                  <p>
                    {reportedMessages.length} reported message
                    {reportedMessages.length === 1 ? '' : 's'}
                  </p>
                  <ul>
                    {reportedMessages.map((m) => {
                      const id = msgId(m);
                      const report = (m.reports || [])[0];
                      return (
                        <li key={id}>
                          <button type="button" onClick={() => jumpTo(id)}>
                            <strong>{report?.reporterName || 'Participant'}</strong>
                            <span>{preview(report?.explanation || m.body)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <ul className="admin-msg-list">
                {visible.map((m) => {
                  const id = msgId(m);
                  const text = m.body ?? m.text ?? m.content ?? '';
                  const reports = Array.isArray(m.reports) ? m.reports : [];
                  const notes = Array.isArray(m.adminNotes) ? m.adminNotes : [];
                  const flagged = reports.length > 0;
                  const noteOpen = noteOpenId === id;
                  return (
                    <li
                      key={id}
                      id={`admin-msg-${id}`}
                      className={`admin-msg${flagged ? ' admin-msg-flagged' : ''}${
                        focusId === id ? ' is-focused' : ''
                      }`}
                    >
                      <div className="admin-msg-meta">
                        <strong>{senderLabel(m)}</strong>
                        <span>{toLocal(m.createdAt) || '—'}</span>
                      </div>
                      <div className="admin-msg-body">
                        {text || <em className="muted">[no text]</em>}
                      </div>

                      {reports.map((r) => (
                        <div key={r.id || r.createdAt} className="admin-msg-report">
                          <div className="admin-callout-label">
                            Reported by {r.reporterName || r.reporterUid || 'participant'}
                          </div>
                          <p>{r.explanation || 'No explanation given.'}</p>
                        </div>
                      ))}

                      <button
                        type="button"
                        className={`admin-msg-memo-toggle${notes.length ? ' has-memo' : ''}`}
                        aria-expanded={noteOpen}
                        onClick={() => setNoteOpenId(noteOpen ? null : id)}
                      >
                        {noteOpen
                          ? 'Hide memo'
                          : notes.length
                            ? `${notes.length} memo${notes.length === 1 ? '' : 's'}`
                            : 'Add memo'}
                      </button>

                      {noteOpen && (
                        <div className="admin-msg-memo">
                          {notes.map((n) => (
                            <div key={n.id || n.createdAt} className="admin-msg-note">
                              <div className="admin-callout-label">
                                {n.authorName || 'Admin'} · {toLocal(n.createdAt) || '—'}
                              </div>
                              <p>{n.body || '—'}</p>
                            </div>
                          ))}
                          <div className="admin-msg-note-form">
                            <textarea
                              rows={2}
                              value={noteDrafts[id] || ''}
                              onChange={(e) =>
                                setNoteDrafts((prev) => ({ ...prev, [id]: e.target.value }))
                              }
                              placeholder="Staff memo (not visible to participants)"
                            />
                            <div className="admin-msg-note-actions">
                              <button
                                type="button"
                                className="admin-btn"
                                disabled={noteSaving === id}
                                onClick={() => saveNote(m)}
                              >
                                {noteSaving === id ? 'Saving…' : 'Save memo'}
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-ghost"
                                onClick={() => setNoteOpenId(null)}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
                {!visible.length && (
                  <li className="muted pad">
                    {view === 'reported'
                      ? 'No reported messages in this conversation.'
                      : 'No messages yet.'}
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
