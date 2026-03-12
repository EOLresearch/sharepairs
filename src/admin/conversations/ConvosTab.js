import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getAllConversations, getAllUsers } from '../../services/matchService';
import { KINSHIP_OPTIONS_EN } from '../../helpers/optionsArrays';
import ConvoViewer from './ConvoViewer';

const POLL_MS = 5000;
const tsToLocal = (ts) => {
  if (ts?.toDate?.().toLocaleString) return ts.toDate().toLocaleString();
  if (ts?.seconds != null) return new Date(ts.seconds * 1000).toLocaleString();
  if (ts?._seconds != null) return new Date(ts._seconds * 1000).toLocaleString();
  return '';
};

const CAUSE_OPTIONS = ['All', 'Natural', 'Unnatural'];
const KINSHIP_OPTIONS = ['All', ...KINSHIP_OPTIONS_EN];

export default function ConvosTab({ notify, confirm, userData }) {
  const [isLoading, setIsLoading] = useState(true);
  const [convos, setConvos] = useState([]);
  const [usersById, setUsersById] = useState({});

  const [search, setSearch] = useState('');
  const [mutualFilter, setMutualFilter] = useState('any');
  const [closedFilter, setClosedFilter] = useState('any');
  const [causeFilter, setCauseFilter] = useState('All');
  const [kinshipFilter, setKinshipFilter] = useState('All');

  const [selected, setSelected] = useState(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    if (!userData?.admin) return;
    setIsLoading(true);

    const poll = async () => {
      try {
        const [convoList, userList] = await Promise.all([
          getAllConversations(),
          getAllUsers(),
        ]);
        const rows = Array.isArray(convoList) ? convoList : [];
        const sorted = [...rows].sort((a, b) => {
          const at = b.lastMsgAt?.seconds ?? b.lastMsgAt?._seconds ?? 0;
          const bt = a.lastMsgAt?.seconds ?? a.lastMsgAt?._seconds ?? 0;
          return at - bt;
        });
        setConvos(sorted.slice(0, 100));

        const map = {};
        (Array.isArray(userList) ? userList : []).forEach((d) => {
          const uid = d.uid ?? d.id;
          if (uid) map[uid] = { uid, ...d };
        });
        setUsersById(map);
      } catch (err) {
        console.error('ConvosTab load failed:', err);
        notify?.('Failed to load conversations.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [userData?.admin, notify]);

  useEffect(() => {
    setShowViewer(false);
  }, [selected?.docID]);

  const matchesMutual = useCallback(
    (c) =>
      mutualFilter === 'any'
        ? true
        : mutualFilter === 'mutual'
          ? !!c.mutualConsent
          : !c.mutualConsent,
    [mutualFilter]
  );

  const matchesClosed = useCallback(
    (c) =>
      closedFilter === 'any'
        ? true
        : closedFilter === 'closed'
          ? !!c.isClosed
          : !c.isClosed,
    [closedFilter]
  );

  const matchesSearch = useCallback(
    (c) => {
      const s = search.trim().toLowerCase();
      if (!s) return true;
      const idHit = c.docID?.toLowerCase?.().includes(s);
      const users = Array.isArray(c.users) ? c.users : [];
      const uidHit = users.some((u) => String(u).toLowerCase().includes(s));
      const nameHit = users.some((u) => {
        const udoc = usersById[u];
        const dn = udoc?.displayName?.toLowerCase?.() || '';
        const email = udoc?.email?.toLowerCase?.() || '';
        return dn.includes(s) || email.includes(s);
      });
      return idHit || uidHit || nameHit;
    },
    [search, usersById]
  );

  const matchesCauseKinship = useCallback(
    (c) => {
      const users = Array.isArray(c.users) ? c.users : [];
      if (causeFilter === 'All' && kinshipFilter === 'All') return true;
      return users.some((uid) => {
        const u = usersById[uid];
        if (!u) return false;
        const causeOk =
          causeFilter === 'All' || (u.cause || '') === causeFilter;
        const kinOk =
          kinshipFilter === 'All' || (u.kinship || '') === kinshipFilter;
        return causeOk && kinOk;
      });
    },
    [causeFilter, kinshipFilter, usersById]
  );

  const filtered = useMemo(
    () =>
      convos
        .filter(matchesMutual)
        .filter(matchesClosed)
        .filter(matchesCauseKinship)
        .filter(matchesSearch),
    [convos, matchesMutual, matchesClosed, matchesCauseKinship, matchesSearch]
  );

  const selectConvo = useCallback((c) => setSelected(c), []);

  const renderUsers = (uids) => {
    if (!Array.isArray(uids)) return '—';
    return uids
      .map((uid) => {
        const u = usersById[uid];
        return u?.displayName ? `${u.displayName} (${uid})` : uid;
      })
      .join(', ');
  };

  return (
    <div className="convos-tab">
      <div
        className="convos-controls"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          placeholder="Search: convo ID, user UID, name, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />

        <label>
          Mutual:&nbsp;
          <select
            value={mutualFilter}
            onChange={(e) => setMutualFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="mutual">Mutual only</option>
            <option value="not">Not mutual</option>
          </select>
        </label>

        <label>
          Status:&nbsp;
          <select
            value={closedFilter}
            onChange={(e) => setClosedFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label>
          Cause:&nbsp;
          <select
            value={causeFilter}
            onChange={(e) => setCauseFilter(e.target.value)}
          >
            {CAUSE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          Kinship:&nbsp;
          <select
            value={kinshipFilter}
            onChange={(e) => setKinshipFilter(e.target.value)}
          >
            {KINSHIP_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <span style={{ opacity: 0.7 }}>
          {isLoading
            ? 'Loading…'
            : `Showing ${filtered.length} of ${convos.length} (polling)`}
        </span>
      </div>

      <div
        className="convos-content"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 16,
          marginTop: 12,
        }}
      >
        <div
          className="convos-table"
          style={{
            overflow: 'auto',
            border: '1px solid #ddd',
            borderRadius: 8,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  Last Activity
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  Convo ID
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  Users
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  Mutual
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  Closed
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  Disabled
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.docID}
                  onClick={() => selectConvo(c)}
                  style={{
                    cursor: 'pointer',
                    background:
                      selected?.docID === c.docID ? '#f7f9ff' : 'transparent',
                  }}
                >
                  <td
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f3f3f3',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tsToLocal(c.lastMsgAt) ||
                      tsToLocal(c.updatedAt) ||
                      '—'}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f3f3f3',
                    }}
                  >
                    {c.docID}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f3f3f3',
                    }}
                  >
                    {renderUsers(c.users)}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f3f3f3',
                    }}
                  >
                    {c.mutualConsent ? 'Yes' : 'No'}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f3f3f3',
                    }}
                  >
                    {c.isClosed ? 'Yes' : 'No'}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f3f3f3',
                    }}
                  >
                    {c.chatDisabled ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 16,
                      textAlign: 'center',
                      color: '#777',
                    }}
                  >
                    No conversations match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="convo-details"
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            minHeight: 360,
          }}
        >
          {!selected ? (
            <div style={{ color: '#777' }}>
              Select a conversation to see details.
            </div>
          ) : showViewer ? (
            <ConvoViewer
              convoId={selected.docID}
              usersById={usersById}
              notify={notify}
              onClose={() => setShowViewer(false)}
            />
          ) : (
            <>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Conversation</h3>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <div>
                  <strong>ID:</strong> {selected.docID}
                </div>
                <div>
                  <strong>Users:</strong> {renderUsers(selected.users)}
                </div>
                <div>
                  <strong>Mutual:</strong>{' '}
                  {selected.mutualConsent ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Closed:</strong>{' '}
                  {selected.isClosed ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Chat Disabled:</strong>{' '}
                  {selected.chatDisabled ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Last Message:</strong>{' '}
                  {tsToLocal(selected.lastMsgAt) || '—'}
                </div>
                <div>
                  <strong>Updated:</strong>{' '}
                  {tsToLocal(selected.updatedAt) || '—'}
                </div>
                <div>
                  <strong>Created:</strong>{' '}
                  {tsToLocal(selected.createdAt) || '—'}
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #eee',
                }}
              >
                <button
                  onClick={() => setShowViewer(true)}
                  style={{ padding: '6px 10px' }}
                >
                  Open Message Viewer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
