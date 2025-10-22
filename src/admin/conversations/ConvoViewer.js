import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { collection, onSnapshot, orderBy, limit, query, getDocs, startAfter } from 'firebase/firestore';
import { db } from '../../fb';

const DEFAULT_PAGE_SIZE = 50;
const toLocal = (ts) => ts?.toDate?.()?.toLocaleString?.() || '';

/**
 * Read-only message viewer for a conversation.
 * Props:
 *  - convoId (string, required)
 *  - usersById (object map uid -> {displayName}, optional)
 *  - onClose (fn, optional)
 *  - pageSize (number, optional)
 *  - notify (fn(type,msg), optional)
 */
export default function ConvoViewer({ convoId, usersById = {}, onClose, pageSize = DEFAULT_PAGE_SIZE, notify }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [messagesAsc, setMessagesAsc] = useState([]); // ascending by time
  const [oldestCursor, setOldestCursor] = useState(null); // last doc of the DESC page
  const [reachedBeginning, setReachedBeginning] = useState(false);

  const unsubRef = useRef(null);

  // Reset when convo changes
  useEffect(() => {
    setInitialLoading(true);
    setOlderLoading(false);
    setMessagesAsc([]);
    setOldestCursor(null);
    setReachedBeginning(false);

    if (!convoId) return;

    // Live subscription to the newest window (DESC, limited)
    const qLatest = query(
      collection(db, 'conversations', convoId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const unsub = onSnapshot(
      qLatest,
      (snap) => {
        const desc = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Track cursor (oldest in this page = last doc)
        const lastDoc = snap.docs[snap.docs.length - 1] || null;
        setOldestCursor(lastDoc);
        // Render ascending
        setMessagesAsc(desc.slice().reverse());
        setInitialLoading(false);
        // If fewer than pageSize, we hit the beginning
        if (snap.size < pageSize) setReachedBeginning(true);
      },
      (err) => {
        console.error('ConvoViewer onSnapshot failed:', err);
        notify?.('Failed to load messages.', 'error');
        setInitialLoading(false);
      }
    );

    unsubRef.current = unsub;
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [convoId, pageSize, notify]);

  const loadOlder = useCallback(async () => {
    if (!convoId || !oldestCursor || olderLoading || reachedBeginning) return;
    setOlderLoading(true);
    try {
      const qOlder = query(
        collection(db, 'conversations', convoId, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(oldestCursor),
        limit(pageSize)
      );
      const snap = await getDocs(qOlder);
      const desc = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const olderAsc = desc.slice().reverse();

      // Prepend olderAsc to current ascending list
      setMessagesAsc((curr) => [...olderAsc, ...curr]);

      // Advance cursor
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      setOldestCursor(lastDoc);

      // If fewer than a full page came back, we reached the beginning
      if (snap.size < pageSize) setReachedBeginning(true);
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
      return {
        id: m.id,
        who: renderSender(m.sentFromUid || m.uid || m.senderUid),
        when,
        text,
      };
    });
  }, [messagesAsc, renderSender]);

  return (
    <div className="convo-viewer" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #eee' }}>
        <strong style={{ flex: 1 }}>Conversation: {convoId || '—'}</strong>
        {onClose && (
          <button onClick={onClose} style={{ padding: '6px 10px' }}>Close</button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {initialLoading ? (
          <div style={{ color: '#777' }}>Loading messages…</div>
        ) : (
          <>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={loadOlder}
                disabled={olderLoading || reachedBeginning}
                style={{ padding: '6px 10px' }}
              >
                {reachedBeginning ? 'No older messages' : (olderLoading ? 'Loading…' : 'Load older')}
              </button>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map((r) => (
                <li key={r.id} style={{ padding: '8px 10px', borderBottom: '1px solid #f3f3f3' }}>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                    <strong>{r.who}</strong> • <span>{r.when}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {r.text || <em style={{ color: '#888' }}>[no text]</em>}
                  </div>
                </li>
              ))}
              {!rows.length && (
                <li style={{ padding: 12, color: '#777' }}>No messages yet.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
