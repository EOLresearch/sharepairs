import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getMessages, fetchOlderMessages } from '../../services/messageService';

const DEFAULT_PAGE_SIZE = 50;
const POLL_MS = 4000;
const toLocal = (ts) => {
  if (ts?.toDate?.().toLocaleString) return ts.toDate().toLocaleString();
  if (ts?.seconds != null) return new Date(ts.seconds * 1000).toLocaleString();
  if (ts && typeof ts === 'object' && ts._seconds != null)
    return new Date(ts._seconds * 1000).toLocaleString();
  return '';
};

export default function ConvoViewer({
  convoId,
  usersById = {},
  onClose,
  pageSize = DEFAULT_PAGE_SIZE,
  notify,
}) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [messagesAsc, setMessagesAsc] = useState([]);
  const [oldestCursor, setOldestCursor] = useState(null);
  const [reachedBeginning, setReachedBeginning] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    setInitialLoading(true);
    setOlderLoading(false);
    setMessagesAsc([]);
    setOldestCursor(null);
    setReachedBeginning(false);

    if (!convoId) return;

    const load = async () => {
      try {
        const list = await getMessages(convoId);
        const msgs = Array.isArray(list) ? list : [];
        const byNewest = [...msgs].sort((a, b) => {
          const ta = a.createdAt?.seconds ?? a.createdAt?._seconds ?? 0;
          const tb = b.createdAt?.seconds ?? b.createdAt?._seconds ?? 0;
          return tb - ta;
        });
        const window = byNewest.slice(0, pageSize);
        setMessagesAsc([...window].reverse());
        setOldestCursor(window.length ? window[window.length - 1] : null);
        setReachedBeginning(byNewest.length < pageSize);
      } catch (err) {
        console.error('ConvoViewer load failed:', err);
        notify?.('Failed to load messages.', 'error');
      } finally {
        setInitialLoading(false);
      }
    };

    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [convoId, pageSize, notify]);

  const loadOlder = useCallback(async () => {
    if (!convoId || !oldestCursor || olderLoading || reachedBeginning) return;
    setOlderLoading(true);
    try {
      const cursor =
        oldestCursor.id ?? oldestCursor.mid ?? oldestCursor.createdAt?.seconds ?? oldestCursor.createdAt?._seconds;
      const { messages: olderMessages, lastDoc, hasMore } = await fetchOlderMessages(
        convoId,
        cursor,
        pageSize
      );
      const olderAsc = Array.isArray(olderMessages) ? olderMessages : [];
      setMessagesAsc((curr) => [...olderAsc, ...curr]);
      setOldestCursor(lastDoc);
      if (!hasMore) setReachedBeginning(true);
    } catch (err) {
      console.error('ConvoViewer loadOlder failed:', err);
      notify?.('Failed to load older messages.', 'error');
    } finally {
      setOlderLoading(false);
    }
  }, [convoId, oldestCursor, olderLoading, reachedBeginning, pageSize, notify]);

  const renderSender = useCallback(
    (uid) => usersById?.[uid]?.displayName || uid || 'Unknown',
    [usersById]
  );

  const rows = useMemo(() => {
    return messagesAsc.map((m) => {
      const text = m.text ?? m.body ?? m.content ?? '';
      const when = toLocal(m.createdAt) || toLocal(m.updatedAt) || '';
      const id = m.id ?? m.mid;
      return {
        id,
        who: renderSender(m.sentFromUid || m.uid || m.senderUid),
        when,
        text,
      };
    });
  }, [messagesAsc, renderSender]);

  return (
    <div
      className="convo-viewer"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid #eee',
        }}
      >
        <strong style={{ flex: 1 }}>Conversation: {convoId || '—'}</strong>
        {onClose && (
          <button onClick={onClose} style={{ padding: '6px 10px' }}>
            Close
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {initialLoading ? (
          <div style={{ color: '#777' }}>Loading messages…</div>
        ) : (
          <>
            <div
              style={{
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={loadOlder}
                disabled={olderLoading || reachedBeginning}
                style={{ padding: '6px 10px' }}
              >
                {reachedBeginning
                  ? 'No older messages'
                  : olderLoading
                    ? 'Loading…'
                    : 'Load older'}
              </button>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #f3f3f3',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#555',
                      marginBottom: 4,
                    }}
                  >
                    <strong>{r.who}</strong> • <span>{r.when}</span>
                  </div>
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {r.text || (
                      <em style={{ color: '#888' }}>[no text]</em>
                    )}
                  </div>
                </li>
              ))}
              {!rows.length && (
                <li style={{ padding: 12, color: '#777' }}>
                  No messages yet.
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
