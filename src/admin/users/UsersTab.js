import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { collection, onSnapshot, orderBy, limit, query } from 'firebase/firestore';
import { db } from '../../fb';
import { KINSHIP_OPTIONS_EN } from '../../helpers/optionsArrays';
import { pairUsers, unpairUsers, toggleChat } from '../actions/adminActions';

const PAGE_LIMIT = 500;
const CAUSE_OPTIONS = ['All', 'Natural', 'Unnatural'];
const KINSHIP_OPTIONS = ['All', ...KINSHIP_OPTIONS_EN];

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

export default function UsersTab({ notify, confirm, userData }) {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);

  // Filters (all client-side)
  const [search, setSearch] = useState('');
  const [causeFilter, setCauseFilter] = useState('All');
  const [kinshipFilter, setKinshipFilter] = useState('All');
  const [chatFilter, setChatFilter] = useState('any');       // 'any' | 'enabled' | 'disabled'
  const [matchFilter, setMatchFilter] = useState('any');     // 'any' | 'matched' | 'unmatched'

  const [selectedUid, setSelectedUid] = useState(null);
  const selectedUser = useMemo(
    () => users.find((u) => u.uid === selectedUid) || null,
    [users, selectedUid]
  );

  // Matching picker state (inside drawer)
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerUid, setPartnerUid] = useState(null);

  // Live users list
  useEffect(() => {
    if (!userData?.admin) return;
    setIsLoading(true);

    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_LIMIT)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        setUsers(rows);
        setIsLoading(false);
      },
      (err) => {
        console.error('onSnapshot(users) failed:', err);
        notify?.('Failed to load users.', 'error');
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [userData?.admin, notify]);

  // Derived: apply filters + search
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    return users.filter((u) => {
      // search: name, email, uid
      const inSearch =
        !s ||
        u.uid?.toLowerCase?.().includes(s) ||
        u.displayName?.toLowerCase?.().includes(s) ||
        u.email?.toLowerCase?.().includes(s);

      if (!inSearch) return false;

      // cause/kinship
      const causeOk = causeFilter === 'All' || (u.cause || '') === causeFilter;
      const kinOk = kinshipFilter === 'All' || (u.kinship || '') === kinshipFilter;
      if (!causeOk || !kinOk) return false;

      // chat
      if (chatFilter !== 'any') {
        const isDisabled = !!u.chatDisabled;
        if (chatFilter === 'enabled' && isDisabled) return false;
        if (chatFilter === 'disabled' && !isDisabled) return false;
      }

      // match
      const m = getMatchUid(u.simpaticoMatch);
      if (matchFilter === 'matched' && !m) return false;
      if (matchFilter === 'unmatched' && m) return false;

      return true;
    });
  }, [users, search, causeFilter, kinshipFilter, chatFilter, matchFilter]);

  // Partner candidates (exclude self)
  const partnerCandidates = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase();
    return users
      .filter((u) => u.uid !== selectedUid)
      .filter((u) => {
        const textHit =
          !q ||
          u.uid?.toLowerCase?.().includes(q) ||
          u.displayName?.toLowerCase?.().includes(q) ||
          u.email?.toLowerCase?.().includes(q);
        return textHit;
      })
      .slice(0, 12);
  }, [users, partnerQuery, selectedUid]);

  // Actions
  const doToggleChat = useCallback(
    async (user) => {
      try {
        await toggleChat(user.uid, !user.chatDisabled);
        notify?.(`Chat ${user.chatDisabled ? 'enabled' : 'disabled'} for ${user.displayName || user.uid}.`, 'success');
      } catch (err) {
        console.error(err);
        notify?.('Failed to toggle chat.', 'error');
      }
    },
    [notify]
  );

  const doUnpair = useCallback(
    (user) => {
      const other = getMatchUid(user?.simpaticoMatch);
      if (!other) {
        notify?.('User is not currently matched.', 'info');
        return;
      }
      confirm?.({
        message: `Unpair ${user.displayName || user.uid} from ${other}?`,
        actionLabel: 'Unpair',
        onConfirm: async () => {
          try {
            await unpairUsers(user.uid, other);
            notify?.('Users unpaired.', 'success');
          } catch (err) {
            console.error(err);
            notify?.(err?.message || 'Failed to unpair.', 'error');
          }
        },
      });
    },
    [confirm, notify]
  );

  const doPair = useCallback(
    (user, targetUid) => {
      if (!targetUid) {
        notify?.('Pick a partner first.', 'info');
        return;
      }
      if (user.uid === targetUid) {
        notify?.('Cannot match a user with themselves.', 'error');
        return;
      }
      const target = users.find((u) => u.uid === targetUid);
      confirm?.({
        message: `Pair ${user.displayName || user.uid} ↔ ${target?.displayName || targetUid}?`,
        actionLabel: 'Pair',
        onConfirm: async () => {
          try {
            await pairUsers(user.uid, targetUid);
            notify?.('Users paired.', 'success');
            setPartnerUid(null);
            setPartnerQuery('');
          } catch (err) {
            console.error(err);
            notify?.(err?.message || 'Failed to pair.', 'error');
          }
        },
      });
    },
    [confirm, notify, users]
  );

  const renderMatchBadge = (u) => getMatchLabel(u.simpaticoMatch, users);

  const renderRow = (u) => {
    const isSelected = selectedUid === u.uid;
    return (
      <tr
        key={u.uid}
        onClick={() => setSelectedUid(u.uid)}
        style={{ cursor: 'pointer', background: isSelected ? '#f7f9ff' : 'transparent' }}
      >
        <td style={td}>{u.displayName || '—'}</td>
        <td style={td}>{u.email || '—'}</td>
        <td style={td}>{u.kinship || '—'}</td>
        <td style={td}>{u.cause || '—'}</td>
        <td style={td}>{u.chatDisabled ? 'Disabled' : 'Enabled'}</td>
        <td style={td}>{renderMatchBadge(u)}</td>
      </tr>
    );
  };

  return (
    <div className="users-tab">
      {/* Controls */}
      <div className="users-controls" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search: name, email, or UID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />

        <label>
          Cause:&nbsp;
          <select value={causeFilter} onChange={(e) => setCauseFilter(e.target.value)}>
            {CAUSE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label>
          Kinship:&nbsp;
          <select value={kinshipFilter} onChange={(e) => setKinshipFilter(e.target.value)}>
            {KINSHIP_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>

        <label>
          Chat:&nbsp;
          <select value={chatFilter} onChange={(e) => setChatFilter(e.target.value)}>
            <option value="any">Any</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>

        <label>
          Match:&nbsp;
          <select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
            <option value="any">Any</option>
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
          </select>
        </label>

        <span style={{ opacity: 0.7 }}>
          {isLoading ? 'Loading…' : `Showing ${filtered.length} of ${users.length} (live)`}
        </span>
      </div>

      {/* Table + Drawer */}
      <div className="users-content" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginTop: 12 }}>
        <div className="users-table" style={{ overflow: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Kinship</th>
                <th style={th}>Cause</th>
                <th style={th}>Chat</th>
                <th style={th}>Match</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(renderRow)}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#777' }}>
                    No users match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right drawer */}
        <div className="user-drawer" style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          {!selectedUser ? (
            <div style={{ color: '#777' }}>Select a user to view details and actions.</div>
          ) : (
            <>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>User</h3>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                <div><strong>UID:</strong> {selectedUser.uid}</div>
                <div><strong>Name:</strong> {selectedUser.displayName || '—'}</div>
                <div><strong>Email:</strong> {selectedUser.email || '—'}</div>
                <div><strong>Kinship:</strong> {selectedUser.kinship || '—'}</div>
                <div><strong>Cause:</strong> {selectedUser.cause || '—'}</div>
                <div><strong>Chat:</strong> {selectedUser.chatDisabled ? 'Disabled' : 'Enabled'}</div>
                <div><strong>Match:</strong> {renderMatchBadge(selectedUser)}</div>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => doToggleChat(selectedUser)} style={{ padding: '6px 10px' }}>
                  {selectedUser.chatDisabled ? 'Enable Chat' : 'Disable Chat'}
                </button>

                <button
                  onClick={() => doUnpair(selectedUser)}
                  disabled={!getMatchUid(selectedUser.simpaticoMatch)}
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
                    onClick={() => doPair(selectedUser, partnerUid)}
                    disabled={!partnerUid}
                    style={{ padding: '6px 10px' }}
                  >
                    Pair Users
                  </button>
                  <button
                    onClick={() => {
                      setPartnerUid(null);
                      setPartnerQuery('');
                    }}
                    style={{ padding: '6px 10px' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const th = { padding: '8px 10px', borderBottom: '1px solid #eee' };
const td = { padding: '8px 10px', borderBottom: '1px solid #f3f3f3' };