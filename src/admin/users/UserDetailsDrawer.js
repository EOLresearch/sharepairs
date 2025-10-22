import React, { useMemo, useState, useCallback } from 'react';

const getMatchUid = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.uid || v.authId || null;
  return null;
};

const getMatchLabel = (v, users) => {
  if (!v) return 'Not matched';
  if (typeof v === 'object') {
    const name = v.displayName || v.email || v.uid || 'Unknown';
    return `Matched (${name})`;
  }
  const uid = String(v);
  const u = users.find((x) => x.uid === uid);
  const name = u?.displayName || u?.email || uid;
  return `Matched (${name})`;
};

function UserDetailsDrawer({
  user,                // selected user object or null
  users = [],          // full users array (for partner search + labels)
  onToggleChat,        // (user) => void|Promise
  onUnpair,            // (user) => void|Promise
  onPair,              // (user, partnerUid) => void|Promise
}) {
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerUid, setPartnerUid] = useState(null);

  const partnerCandidates = useMemo(() => {
    if (!user) return [];
    const q = partnerQuery.trim().toLowerCase();
    return users
      .filter((u) => u.uid !== user.uid)
      .filter((u) => {
        if (!q) return true;
        return (
          u.uid?.toLowerCase?.().includes(q) ||
          u.displayName?.toLowerCase?.().includes(q) ||
          u.email?.toLowerCase?.().includes(q)
        );
      })
      .slice(0, 12);
  }, [users, user, partnerQuery]);

  const clearPicker = useCallback(() => {
    setPartnerUid(null);
    setPartnerQuery('');
  }, []);

  if (!user) {
    return <div style={{ color: '#777' }}>Select a user to view details and actions.</div>;
  }

  const matchBadge = getMatchLabel(user.simpaticoMatch, users);

  return (
    <div className="user-drawer" style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>User</h3>

      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
        <div><strong>UID:</strong> {user.uid}</div>
        <div><strong>Name:</strong> {user.displayName || '—'}</div>
        <div><strong>Email:</strong> {user.email || '—'}</div>
        <div><strong>Kinship:</strong> {user.kinship || '—'}</div>
        <div><strong>Cause:</strong> {user.cause || '—'}</div>
        <div><strong>Chat:</strong> {user.chatDisabled ? 'Disabled' : 'Enabled'}</div>
        <div><strong>Match:</strong> {matchBadge}</div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onToggleChat?.(user)} style={{ padding: '6px 10px' }}>
          {user.chatDisabled ? 'Enable Chat' : 'Disable Chat'}
        </button>

        <button
          onClick={() => onUnpair?.(user)}
          disabled={!getMatchUid(user.simpaticoMatch)}
          style={{ padding: '6px 10px' }}
        >
          Remove Match
        </button>
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee' }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Add Match</div>
        <input
          type="text"
          placeholder="Search partner by name, email, or UID"
          value={partnerQuery}
          onChange={(e) => {
            setPartnerQuery(e.target.value);
            setPartnerUid(null);
          }}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
          {partnerCandidates.length === 0 ? (
            <div style={{ padding: 8, color: '#777' }}>No candidates.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {partnerCandidates.map((u) => {
                const isChosen = partnerUid === u.uid;
                const alreadyMatched = !!getMatchUid(u.simpaticoMatch);
                return (
                  <li
                    key={u.uid}
                    onClick={() => setPartnerUid(u.uid)}
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f6f6f6',
                      cursor: 'pointer',
                      background: isChosen ? '#f7f9ff' : 'transparent'
                    }}
                    title={alreadyMatched ? 'This user is already matched' : ''}
                  >
                    <div style={{ fontSize: 13 }}>
                      <strong>{u.displayName || '—'}</strong> • {u.email || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {u.uid} — {u.kinship || '—'} / {u.cause || '—'} {alreadyMatched ? ' • matched' : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button
            onClick={() => onPair?.(user, partnerUid)}
            disabled={!partnerUid}
            style={{ padding: '6px 10px' }}
          >
            Pair Users
          </button>
          <button onClick={clearPicker} style={{ padding: '6px 10px' }}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(UserDetailsDrawer);