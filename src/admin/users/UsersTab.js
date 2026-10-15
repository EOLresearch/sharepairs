import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getAllUsers, getUserDistress, listEligibleScreeners, issueScreenerAccessCode } from '../../services/matchService';
import { KINSHIP_OPTIONS_EN } from '../../helpers/optionsArrays';
import { pairUsers, unpairUsers, toggleChat, deleteUser, addUserNote } from '../actions/adminActions';
import AdminMemoSection from '../AdminMemoSection';

const POLL_MS = 5000;
const CAUSE_OPTIONS = ['All', 'Natural', 'Unnatural'];
const KINSHIP_OPTIONS = ['All', ...KINSHIP_OPTIONS_EN];
const getMatchUid = (v) => {
  if (v == null || v === '' || v === false) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    return s || null;
  }
  if (typeof v === 'object') {
    const uid = v.uid || v.authId || null;
    return uid ? String(uid) : null;
  }
  return null;
};

const formatWhen = (ts) => {
  if (ts == null) return '—';
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n)) return '—';
  const d = new Date(n < 1e12 ? n * 1000 : n);
  return d.toLocaleString();
};

export default function UsersTab({ notify, confirm, userData, onViewUserConversations }) {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState('');
  const [causeFilter, setCauseFilter] = useState('All');
  const [kinshipFilter, setKinshipFilter] = useState('All');
  const [chatFilter, setChatFilter] = useState('any');
  const [matchFilter, setMatchFilter] = useState('any');

  const [selectedUid, setSelectedUid] = useState(null);
  const selectedUser = useMemo(
    () => users.find((u) => u.uid === selectedUid) || null,
    [users, selectedUid]
  );

  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerUid, setPartnerUid] = useState(null);

  const [distress, setDistress] = useState([]);
  const [distressLoading, setDistressLoading] = useState(false);
  const [distressAll, setDistressAll] = useState(false);
  const [screeners, setScreeners] = useState([]);
  const [screenersNote, setScreenersNote] = useState('');
  const [codeBusyId, setCodeBusyId] = useState('');

  const refreshUsers = useCallback(async ({ quiet } = {}) => {
    try {
      if (!quiet) setIsLoading(true);
      const list = await getAllUsers();
      const rows = Array.isArray(list) ? list : [];
      setUsers(
        [...rows]
          .sort((a, b) => {
            const at = b.createdAt?.seconds ?? b.createdAt?._seconds ?? b.created_at ?? 0;
            const bt = a.createdAt?.seconds ?? a.createdAt?._seconds ?? a.created_at ?? 0;
            return Number(at) - Number(bt);
          })
          .slice(0, 500)
      );
    } catch (err) {
      console.error('UsersTab load failed:', err);
      notify?.('Failed to load users.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const refreshScreeners = useCallback(async () => {
    try {
      const data = await listEligibleScreeners();
      setScreeners(Array.isArray(data?.screeners) ? data.screeners : []);
      setScreenersNote('');
    } catch (err) {
      console.error('Screener list failed:', err);
      setScreenersNote(err?.message || 'Could not load eligible screeners.');
    }
  }, []);

  useEffect(() => {
    if (!userData?.admin) return;
    refreshUsers();
    refreshScreeners();
    const interval = setInterval(() => {
      refreshUsers({ quiet: true });
      refreshScreeners();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [userData?.admin, refreshUsers, refreshScreeners]);

  const loadDistress = useCallback(
    async (uid, { all = false } = {}) => {
      if (!uid) {
        setDistress([]);
        return;
      }
      setDistressLoading(true);
      try {
        const data = await getUserDistress(uid, all ? { all: true } : { limit: 5 });
        setDistress(Array.isArray(data?.events) ? data.events : []);
        setDistressAll(!!all);
      } catch (err) {
        console.error(err);
        setDistress([]);
        notify?.('Failed to load distress readings.', 'error');
      } finally {
        setDistressLoading(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    setPartnerUid(null);
    setPartnerQuery('');
    setDistressAll(false);
    if (selectedUid) loadDistress(selectedUid, { all: false });
    else setDistress([]);
  }, [selectedUid, loadDistress]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    return users.filter((u) => {
      const inSearch =
        !s ||
        u.uid?.toLowerCase?.().includes(s) ||
        u.displayName?.toLowerCase?.().includes(s) ||
        u.email?.toLowerCase?.().includes(s);

      if (!inSearch) return false;

      const causeOk = causeFilter === 'All' || (u.cause || '') === causeFilter;
      const kinOk =
        kinshipFilter === 'All' || (u.kinship || '') === kinshipFilter;
      if (!causeOk || !kinOk) return false;

      if (chatFilter !== 'any') {
        const isDisabled = !!u.chatDisabled;
        if (chatFilter === 'enabled' && isDisabled) return false;
        if (chatFilter === 'disabled' && !isDisabled) return false;
      }

      const m = getMatchUid(u.simpaticoMatch);
      if (matchFilter === 'matched' && !m) return false;
      if (matchFilter === 'unmatched' && m) return false;

      return true;
    });
  }, [users, search, causeFilter, kinshipFilter, chatFilter, matchFilter]);

  const partnerCandidates = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase();
    return users
      .filter((u) => u.uid !== selectedUid)
      // Allow matching Cornell/test admins; only exclude Study Support
      .filter((u) => !u.isSupport)
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

  const matchUid = getMatchUid(selectedUser?.simpaticoMatch);
  const canCreateMatch = Boolean(partnerUid);
  const matchPartner = useMemo(() => {
    if (!matchUid) return null;
    const fromList = users.find((u) => u.uid === matchUid);
    if (fromList) return fromList;
    const m = selectedUser?.simpaticoMatch;
    if (m && typeof m === 'object') return m;
    return { uid: matchUid };
  }, [matchUid, users, selectedUser]);

  const doToggleChat = useCallback(
    async (user) => {
      try {
        const nextDisabled = !user.chatDisabled;
        await toggleChat(user.uid, nextDisabled);
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === user.uid ? { ...u, chatDisabled: nextDisabled } : u
          )
        );
        notify?.(
          `Chat ${nextDisabled ? 'disabled' : 'enabled'} for ${user.displayName || user.uid}.`,
          'success'
        );
      } catch (err) {
        console.error(err);
        notify?.(err?.message || 'Failed to toggle chat.', 'error');
      }
    },
    [notify]
  );

  const doUnpair = useCallback(
    (user) => {
      const other = getMatchUid(user?.simpaticoMatch);
      if (!other) return;
      const otherLabel =
        users.find((u) => u.uid === other)?.displayName ||
        user?.simpaticoMatch?.displayName ||
        other;
      confirm?.({
        message: `Remove Simpatico Match between ${user.displayName || user.uid} and ${otherLabel}?`,
        actionLabel: 'Remove Match',
        onConfirm: async () => {
          try {
            await unpairUsers(user.uid, other);
            setUsers((prev) =>
              prev.map((u) => {
                if (u.uid === user.uid || u.uid === other) {
                  return { ...u, simpaticoMatch: null };
                }
                return u;
              })
            );
            notify?.('Match removed.', 'success');
          } catch (err) {
            console.error(err);
            notify?.(err?.message || 'Failed to remove match.', 'error');
          }
        },
      });
    },
    [confirm, notify, users]
  );

  const doDeleteUser = useCallback(
    (user) => {
      if (!user?.uid) return;
      const label = user.displayName || user.email || user.uid;
      confirm?.({
        message: `Permanently delete ${label}? This removes the account so you can register again with the same email. For testing only.`,
        actionLabel: 'Delete User',
        onConfirm: async () => {
          try {
            await deleteUser(user.uid);
            setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
            setSelectedUid((cur) => (cur === user.uid ? null : cur));
            notify?.(`Deleted ${label}. You can register that email again.`, 'success');
          } catch (err) {
            console.error(err);
            notify?.(err?.message || 'Failed to delete user.', 'error');
          }
        },
      });
    },
    [confirm, notify]
  );

  const copyCode = useCallback(async (email, code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      notify?.(`Access code for ${email} copied.`, 'success');
    } catch {
      notify?.(`Access code for ${email}: ${code}`, 'success');
    }
  }, [notify]);

  const doIssueCode = useCallback((row) => {
    if (!row?.id || !row.email) return;
    confirm?.({
      message: `Replace the password for ${row.email} with a new access code? The previous password will stop working.`,
      actionLabel: 'Issue new code',
      onConfirm: async () => {
        setCodeBusyId(row.id);
        try {
          const data = await issueScreenerAccessCode(row.id);
          await refreshScreeners();
          const code = data?.accessCode || '';
          if (code) await copyCode(row.email, code);
          else notify?.(`New access code issued for ${row.email}.`, 'success');
        } catch (err) {
          console.error(err);
          notify?.(err?.message || 'Could not issue an access code.', 'error');
        } finally {
          setCodeBusyId('');
        }
      },
    });
  }, [confirm, copyCode, notify, refreshScreeners]);

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
      const userAlready = getMatchUid(user.simpaticoMatch);
      const targetAlready = getMatchUid(target?.simpaticoMatch);
      const warn =
        userAlready || targetAlready
          ? ' One or both are already matched — their current matches will be cleared.'
          : '';
      confirm?.({
        message: `Match ${user.displayName || user.uid} ↔ ${target?.displayName || targetUid}?${warn}`,
        actionLabel: 'Match',
        onConfirm: async () => {
          try {
            await pairUsers(user.uid, targetUid);
            const aRef = {
              uid: target.uid,
              displayName: target.displayName || target.email || target.uid,
              photoURL: target.photoURL || '',
            };
            const bRef = {
              uid: user.uid,
              displayName: user.displayName || user.email || user.uid,
              photoURL: user.photoURL || '',
            };
            setUsers((prev) =>
              prev.map((u) => {
                if (u.uid === user.uid) return { ...u, simpaticoMatch: aRef };
                if (u.uid === targetUid) return { ...u, simpaticoMatch: bRef };
                // clear anyone previously matched to either
                const m = getMatchUid(u.simpaticoMatch);
                if (m === user.uid || m === targetUid) {
                  return { ...u, simpaticoMatch: null };
                }
                return u;
              })
            );
            setPartnerUid(null);
            setPartnerQuery('');
            notify?.('Participants matched.', 'success');
            await refreshUsers({ quiet: true });
          } catch (err) {
            console.error(err);
            notify?.(err?.message || 'Failed to match.', 'error');
          }
        },
      });
    },
    [confirm, notify, users, refreshUsers]
  );

  const matchLabel = (u) => {
    const mid = getMatchUid(u.simpaticoMatch);
    if (!mid) return 'Unmatched';
    if (typeof u.simpaticoMatch === 'object' && u.simpaticoMatch.displayName) {
      return u.simpaticoMatch.displayName;
    }
    const partner = users.find((x) => x.uid === mid);
    return partner?.displayName || partner?.email || mid;
  };

  return (
    <div className="users-tab">
      <div className="users-controls">
        <input
          type="text"
          className="admin-search"
          placeholder="Search name, email, or UID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label>
          Cause
          <select value={causeFilter} onChange={(e) => setCauseFilter(e.target.value)}>
            {CAUSE_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label>
          Kinship
          <select value={kinshipFilter} onChange={(e) => setKinshipFilter(e.target.value)}>
            {KINSHIP_OPTIONS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        <label>
          Chat
          <select value={chatFilter} onChange={(e) => setChatFilter(e.target.value)}>
            <option value="any">Any</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>

        <label>
          Simpatico Match
          <select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
            <option value="any">Any</option>
            <option value="matched">Simpatico Match</option>
            <option value="unmatched">Unmatched</option>
          </select>
        </label>

        <span className="users-count">
          {isLoading ? 'Loading…' : `${filtered.length} of ${users.length}`}
        </span>

      </div>

      <section className="eligible-screeners">
        <h4>Eligible participants</h4>
        <p>
          When the screener marks someone eligible, Share Pairs creates their login.
          They sign in with this email. The access code is the password until they change it.
        </p>
        {screenersNote ? <p className="eligible-note">{screenersNote}</p> : null}
        {screeners.length === 0 && !screenersNote ? (
          <p className="eligible-note">No eligible screeners yet.</p>
        ) : (
          <ul className="eligible-list">
            {screeners.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.email || 'No email'}</strong>
                  <span>{row.kinship || 'Kinship not recorded'}</span>
                </div>
                {row.accountReady && row.accessCode ? (
                  <code>{row.accessCode}</code>
                ) : row.passwordChanged ? (
                  <span>Password changed</span>
                ) : (
                  <span>{row.error || 'Login not ready'}</span>
                )}
                <div className="eligible-actions">
                  {row.accessCode ? (
                    <button type="button" className="btn" onClick={() => copyCode(row.email, row.accessCode)}>
                      Copy code
                    </button>
                  ) : null}
                  {row.accountReady ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => doIssueCode(row)}
                      disabled={codeBusyId === row.id}
                    >
                      {codeBusyId === row.id ? 'Issuing…' : 'New access code'}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="users-content">
        <div className="users-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Kinship</th>
                <th>Cause</th>
                <th>Chat</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelected = selectedUid === u.uid;
                return (
                  <tr
                    key={u.uid}
                    onClick={() => setSelectedUid(u.uid)}
                    className={isSelected ? 'selected' : ''}
                  >
                    <td>{u.displayName || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{u.kinship || '—'}</td>
                    <td>{u.cause || '—'}</td>
                    <td>
                      <span className={`pill ${u.chatDisabled ? 'pill-warn' : 'pill-ok'}`}>
                        {u.chatDisabled ? 'Disabled' : 'Enabled'}
                      </span>
                    </td>
                    <td>{matchLabel(u)}</td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No participants match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="user-drawer">
          {!selectedUser ? (
            <div className="drawer-empty">
              <p>Select a participant to view details, match them, or manage chat.</p>
            </div>
          ) : (
            <>
              <header className="drawer-header">
                <h3>{selectedUser.displayName || 'Participant'}</h3>
                <p className="drawer-email">{selectedUser.email || '—'}</p>
              </header>

              <dl className="drawer-meta">
                <div>
                  <dt>UID</dt>
                  <dd className="mono">{selectedUser.uid}</dd>
                </div>
                <div>
                  <dt>Kinship</dt>
                  <dd>{selectedUser.kinship || '—'}</dd>
                </div>
                <div>
                  <dt>Cause</dt>
                  <dd>{selectedUser.cause || '—'}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{selectedUser.preferredLanguage || '—'}</dd>
                </div>
                <div>
                  <dt>Chat</dt>
                  <dd>{selectedUser.chatDisabled ? 'Disabled' : 'Enabled'}</dd>
                </div>
                <div>
                  <dt>Match</dt>
                  <dd>
                    {matchUid
                      ? (matchPartner?.displayName || matchPartner?.email || matchUid)
                      : 'None'}
                  </dd>
                </div>
              </dl>

              <div className="drawer-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => doToggleChat(selectedUser)}
                >
                  {selectedUser.chatDisabled ? 'Enable Chat' : 'Disable Chat'}
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => onViewUserConversations?.(selectedUser.uid)}
                >
                  View Conversations
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => doDeleteUser(selectedUser)}
                >
                  Delete User
                </button>
              </div>

              <section className="drawer-section">
                <h4>Distress thermometer</h4>
                {distressLoading ? (
                  <p className="muted">Loading…</p>
                ) : distress.length === 0 ? (
                  <p className="muted">No readings yet.</p>
                ) : (
                  <ul className="distress-list">
                    {distress.map((e) => (
                      <li key={e.id}>
                        <span className={`distress-score ${e.score >= 70 ? 'high' : ''}`}>
                          {e.score}
                        </span>
                        <span className="distress-when">{formatWhen(e.createdAt)}</span>
                        {e.status === 'notify_failed' && (
                          <span className="distress-status notify-failed">
                            Notify failed — follow up
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!distressLoading && distress.length > 0 && !distressAll && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => loadDistress(selectedUid, { all: true })}
                  >
                    Load all readings
                  </button>
                )}
                {distressAll && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => loadDistress(selectedUid, { all: false })}
                  >
                    Show latest 5
                  </button>
                )}
              </section>

              <AdminMemoSection
                notes={selectedUser.adminNotes}
                notify={notify}
                onSave={async (text) => {
                  const result = await addUserNote(selectedUser.uid, text);
                  const next = result?.user;
                  setUsers((prev) =>
                    prev.map((u) =>
                      u.uid === selectedUser.uid
                        ? { ...u, ...(next || {}), adminNotes: next?.adminNotes || u.adminNotes }
                        : u
                    )
                  );
                }}
              />

              {matchUid ? (
                <section className="drawer-section">
                  <h4>Simpatico Match</h4>
                  <p className="muted">
                    Simpatico Match with{' '}
                    <strong>
                      {matchPartner?.displayName || matchPartner?.email || matchUid}
                    </strong>
                  </p>
                  <div className="drawer-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      onClick={() => doUnpair(selectedUser)}
                    >
                      Remove Simpatico Match
                    </button>
                  </div>

                  <h4 style={{ marginTop: 14 }}>Replace Simpatico Match</h4>
                  <p className="muted">
                    Pick a new partner below to replace the current Simpatico Match.
                  </p>
                  <input
                    type="text"
                    className="admin-search full"
                    placeholder="Search new partner…"
                    value={partnerQuery}
                    onChange={(e) => {
                      setPartnerQuery(e.target.value);
                      setPartnerUid(null);
                    }}
                  />
                  <div className="partner-list">
                    {partnerCandidates.length === 0 ? (
                      <div className="muted pad">No candidates.</div>
                    ) : (
                      <ul>
                        {partnerCandidates.map((u) => {
                          const isChosen = partnerUid === u.uid;
                          return (
                            <li
                              key={u.uid}
                              className={isChosen ? 'chosen' : ''}
                              onClick={() => setPartnerUid(u.uid)}
                            >
                              <strong>{u.displayName || '—'}</strong>
                              <span>{u.email || '—'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="drawer-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => doPair(selectedUser, partnerUid)}
                      disabled={!canCreateMatch}
                    >
                      Replace Match
                    </button>
                  </div>
                </section>
              ) : (
                <section className="drawer-section">
                  <h4>Match with partner</h4>
                  <input
                    type="text"
                    className="admin-search full"
                    placeholder="Search partner by name, email, or UID"
                    value={partnerQuery}
                    onChange={(e) => {
                      setPartnerQuery(e.target.value);
                      setPartnerUid(null);
                    }}
                  />
                  <div className="partner-list">
                    {partnerCandidates.length === 0 ? (
                      <div className="muted pad">No candidates.</div>
                    ) : (
                      <ul>
                        {partnerCandidates.map((u) => {
                          const isChosen = partnerUid === u.uid;
                          const alreadyMatched = !!getMatchUid(u.simpaticoMatch);
                          return (
                            <li
                              key={u.uid}
                              className={isChosen ? 'chosen' : ''}
                              onClick={() => setPartnerUid(u.uid)}
                            >
                              <strong>{u.displayName || '—'}</strong>
                              <span>{u.email || '—'}</span>
                              <span className="muted small">
                                {u.kinship || '—'} / {u.cause || '—'}
                                {alreadyMatched ? ' · already a Simpatico Match' : ''}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="drawer-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => doPair(selectedUser, partnerUid)}
                      disabled={!canCreateMatch}
                    >
                      Create Simpatico Match
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => {
                        setPartnerUid(null);
                        setPartnerQuery('');
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
