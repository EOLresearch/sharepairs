import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getAllConversations, getAllUsers } from '../../services/matchService';
import { KINSHIP_OPTIONS_EN } from '../../helpers/optionsArrays';
import { setConvoModeration, setConvoMonitor, addConversationNote, assignConversation, deleteConversation } from '../actions/adminActions';
import ConvoViewer from './ConvoViewer';
import AdminMemoSection from '../AdminMemoSection';
import { moderationStatusOf } from '../../helpers/conversationModeration';
import { getSupportUid } from '../../constants';

const POLL_MS = 5000;
const CAUSE_OPTIONS = ['All', 'Natural', 'Unnatural'];
const KINSHIP_OPTIONS = ['All', ...KINSHIP_OPTIONS_EN];

const tsToLocal = (ts) => {
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

const activityMs = (c) => {
  const v = c?.lastMsgAt ?? c?.updatedAt ?? c?.createdAt ?? 0;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  if (v?.seconds != null) return v.seconds * 1000;
  if (v?._seconds != null) return v._seconds * 1000;
  return 0;
};

export default function ConvosTab({
  notify,
  confirm,
  userData,
  initialSearch,
  onInitialSearchConsumed,
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [convos, setConvos] = useState([]);
  const [usersById, setUsersById] = useState({});

  const [search, setSearch] = useState(initialSearch || '');
  const [mutualFilter, setMutualFilter] = useState('any');
  const [closedFilter, setClosedFilter] = useState('any');
  const [reviewFilter, setReviewFilter] = useState('any');
  const [assignFilter, setAssignFilter] = useState('any');
  const [causeFilter, setCauseFilter] = useState('All');
  const [kinshipFilter, setKinshipFilter] = useState('All');

  const [selectedId, setSelectedId] = useState(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    if (initialSearch == null || initialSearch === '') return;
    setSearch(initialSearch);
    onInitialSearchConsumed?.();
  }, [initialSearch, onInitialSearchConsumed]);

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
        setConvos(
          [...rows]
            .sort((a, b) => {
              const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
              if (pin) return pin;
              const review =
                Number(Boolean(b.highPriority || b.needsReview || b.reportCount)) -
                Number(Boolean(a.highPriority || a.needsReview || a.reportCount));
              if (review) return review;
              return activityMs(b) - activityMs(a);
            })
            .slice(0, 200)
        );

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

  const selected = useMemo(
    () => convos.find((c) => c.docID === selectedId) || null,
    [convos, selectedId]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return convos.filter((c) => {
      if (mutualFilter === 'mutual' && !c.mutualConsent) return false;
      if (mutualFilter === 'not' && c.mutualConsent) return false;
      const ended = Boolean(c.isClosed) || moderationStatusOf(c) === 'terminated';
      if (closedFilter === 'closed' && !ended) return false;
      if (closedFilter === 'open' && ended) return false;
      if (reviewFilter === 'review' && !c.needsReview) {
        return false;
      }
      if (assignFilter === 'unassigned' && c.assignedToUid) return false;
      if (assignFilter === 'me' && c.assignedToUid !== userData?.uid && c.assignedToUid !== userData?.authId) {
        return false;
      }
      if (reviewFilter === 'pinned' && !c.pinned) return false;
      if (reviewFilter === 'priority' && !c.highPriority) return false;

      const users = Array.isArray(c.users) ? c.users : [];
      if (causeFilter !== 'All' || kinshipFilter !== 'All') {
        const ok = users.some((uid) => {
          const u = usersById[uid];
          if (!u) return false;
          const causeOk = causeFilter === 'All' || (u.cause || '') === causeFilter;
          const kinOk =
            kinshipFilter === 'All' || (u.kinship || '') === kinshipFilter;
          return causeOk && kinOk;
        });
        if (!ok) return false;
      }

      if (!s) return true;
      if (c.docID?.toLowerCase?.().includes(s)) return true;
      return users.some((uid) => {
        const u = usersById[uid];
        return (
          String(uid).toLowerCase().includes(s) ||
          u?.displayName?.toLowerCase?.().includes(s) ||
          u?.email?.toLowerCase?.().includes(s)
        );
      });
    });
  }, [
    convos,
    search,
    mutualFilter,
    closedFilter,
    reviewFilter,
    assignFilter,
    causeFilter,
    kinshipFilter,
    usersById,
    userData,
  ]);

  const participantNames = useCallback(
    (uids) => {
      if (!Array.isArray(uids) || !uids.length) return '—';
      return uids
        .map((uid) => usersById[uid]?.displayName || usersById[uid]?.email || uid)
        .join(' ↔ ');
    },
    [usersById]
  );

  const adminUsers = useMemo(
    () =>
      Object.values(usersById)
        .filter((u) => u?.admin && !u?.isSupport)
        .sort((a, b) => String(a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')),
    [usersById]
  );

  const anyChatDisabled = useCallback(
    (uids) =>
      Array.isArray(uids) &&
      uids.some((uid) => Boolean(usersById[uid]?.chatDisabled)),
    [usersById]
  );

  const openViewer = () => {
    if (!selected) return;
    setShowViewer(true);
  };

  const applyModeration = (status, message, actionLabel) => {
    if (!selected?.docID) return;
    const run = async () => {
      try {
        await setConvoModeration(selected.docID, status);
        setConvos((prev) =>
          prev.map((c) =>
            c.docID === selected.docID
              ? {
                  ...c,
                  moderationStatus: status,
                  isClosed: status === 'terminated',
                }
              : c
          )
        );
        notify?.(
          status === 'paused'
            ? 'Conversation paused. Both participants can no longer send messages.'
            : status === 'terminated'
              ? 'Conversation ended. Both participants can no longer send messages.'
              : 'Conversation reopened. Participants can send messages again.',
          'success'
        );
      } catch (err) {
        console.error(err);
        notify?.(err?.message || 'Failed to update conversation.', 'error');
      }
    };
    if (confirm) {
      confirm({ message, actionLabel, onConfirm: run });
    } else {
      run();
    }
  };

  const removeConversation = (convo) => {
    const id = convo?.docID;
    if (!id) return;
    const names = participantNames(convo.users);
    const run = async () => {
      try {
        await deleteConversation(id);
        setConvos((prev) => prev.filter((c) => c.docID !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
        setShowViewer(false);
        notify?.('Conversation deleted.', 'success');
      } catch (err) {
        console.error(err);
        notify?.(err?.message || 'Failed to delete conversation.', 'error');
      }
    };
    const message = `Delete the conversation between ${names}? Messages in this thread will be removed. Their match stays.`;
    if (confirm) {
      confirm({ message, actionLabel: 'Delete', onConfirm: run });
    } else {
      run();
    }
  };

  const applyMonitor = async (flags, successMessage) => {
    if (!selected?.docID) return;
    try {
      const result = await setConvoMonitor(selected.docID, flags);
      const next = result?.conversation;
      setConvos((prev) =>
        prev.map((c) =>
          c.docID === selected.docID
            ? {
                ...c,
                ...(next || {}),
                pinned: flags.pinned !== undefined ? flags.pinned : c.pinned,
                needsReview: flags.needsReview !== undefined ? flags.needsReview : c.needsReview,
                highPriority:
                  flags.highPriority !== undefined ? flags.highPriority : c.highPriority,
              }
            : c
        )
      );
      notify?.(successMessage, 'success');
    } catch (err) {
      console.error(err);
      notify?.(err?.message || 'Failed to update conversation flags.', 'error');
    }
  };

  const applyAssign = async (uid) => {
    if (!selected?.docID) return;
    try {
      const result = await assignConversation(selected.docID, uid || null);
      const next = result?.conversation;
      setConvos((prev) =>
        prev.map((c) =>
          c.docID === selected.docID
            ? {
                ...c,
                ...(next || {}),
                assignedToUid: next?.assignedToUid ?? null,
                assignedToName: next?.assignedToName || '',
                assignedAt: next?.assignedAt || null,
                assignedByUid: next?.assignedByUid || null,
                assignedByName: next?.assignedByName || '',
              }
            : c
        )
      );
      notify?.(
        uid ? `Assigned to ${next?.assignedToName || 'admin'}. Participants cannot see this.` : 'Assignment cleared.',
        'success'
      );
    } catch (err) {
      console.error(err);
      notify?.(err?.message || 'Failed to update assignment.', 'error');
    }
  };

  const messagingPill = (c) => {
    const status = moderationStatusOf(c);
    if (status === 'terminated') return { label: 'Terminated', cls: 'pill-warn' };
    if (status === 'paused') return { label: 'Paused', cls: 'pill-paused' };
    if (c.isClosed) return { label: 'Closed', cls: 'pill-warn' };
    return { label: 'Open', cls: 'pill-ok' };
  };

  return (
    <div className="convos-tab users-tab">
      <div className="users-controls">
        <input
          type="text"
          className="admin-search"
          placeholder="Search ID, name, email, or UID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label>
          Mutual
          <select
            value={mutualFilter}
            onChange={(e) => setMutualFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="mutual">Mutual</option>
            <option value="not">Not mutual</option>
          </select>
        </label>

        <label>
          Status
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
          Review
          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="review">Needs review</option>
            <option value="priority">High priority</option>
            <option value="pinned">Pinned</option>
          </select>
        </label>

        <label>
          Assigned
          <select
            value={assignFilter}
            onChange={(e) => setAssignFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Assigned to me</option>
          </select>
        </label>

        <label>
          Cause
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
          Kinship
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

        <span className="users-count">
          {isLoading ? 'Loading…' : `${filtered.length} of ${convos.length}`}
        </span>
      </div>

      <div className="users-content">
        <div className="users-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participants</th>
                <th>Last activity</th>
                <th>Preview</th>
                <th>Assigned</th>
                <th>Flags</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isSelected = selectedId === c.docID;
                return (
                  <tr
                    key={c.docID}
                    className={`${isSelected ? 'selected' : ''}${
                      c.needsReview || c.highPriority || c.reportCount ? ' needs-review-row' : ''
                    }`}
                    onClick={() => setSelectedId(c.docID)}
                  >
                    <td>{participantNames(c.users)}</td>
                    <td>{tsToLocal(c.lastMsgAt) || tsToLocal(c.updatedAt) || '—'}</td>
                    <td className="preview-cell">
                      {c.lastMsgPreview || '—'}
                    </td>
                    <td>
                      {c.assignedToName || c.assignedToUid ? (
                        <span className="pill pill-pin">{c.assignedToName || c.assignedToUid}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="flags-cell">
                      {c.pinned ? <span className="pill pill-pin">Pinned</span> : null}
                      {c.highPriority ? <span className="pill pill-warn">Priority</span> : null}
                      {c.needsReview ? <span className="pill pill-review">Review</span> : null}
                      {Number(c.reportCount || 0) > 0 ? (
                        <span className="pill pill-warn">Reports {c.reportCount}</span>
                      ) : null}
                      {!c.pinned &&
                      !c.highPriority &&
                      !c.needsReview &&
                      !c.reportCount ? (
                        <span className="muted">—</span>
                      ) : null}
                    </td>
                    <td>
                      {(() => {
                        const pill = messagingPill(c);
                        return <span className={`pill ${pill.cls}`}>{pill.label}</span>;
                      })()}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeConversation(c);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No conversations match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="user-drawer">
          {!selected ? (
            <div className="drawer-empty">
              Select a conversation to view details and open the message viewer.
            </div>
          ) : (
            <>
              <header className="drawer-header">
                <h3>Conversation</h3>
                <p className="drawer-email">{participantNames(selected.users)}</p>
              </header>

              <dl className="drawer-meta">
                <div>
                  <dt>ID</dt>
                  <dd className="mono">{selected.docID}</dd>
                </div>
                <div>
                  <dt>Mutual</dt>
                  <dd>{selected.mutualConsent ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{messagingPill(selected).label}</dd>
                </div>
                <div>
                  <dt>Chat</dt>
                  <dd>
                    {anyChatDisabled(selected.users)
                      ? 'A participant has chat disabled'
                      : 'Enabled'}
                  </dd>
                </div>
                <div>
                  <dt>Last msg</dt>
                  <dd>{tsToLocal(selected.lastMsgAt) || '—'}</dd>
                </div>
                <div>
                  <dt>Preview</dt>
                  <dd>{selected.lastMsgPreview || '—'}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{tsToLocal(selected.createdAt) || '—'}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{tsToLocal(selected.updatedAt) || '—'}</dd>
                </div>
                <div>
                  <dt>Reports</dt>
                  <dd>{Number(selected.reportCount || 0)}</dd>
                </div>
                <div>
                  <dt>Assigned</dt>
                  <dd>{selected.assignedToName || 'Unassigned'}</dd>
                </div>
              </dl>

              <div className="drawer-section">
                <h4>Participants</h4>
                <ul className="partner-list" style={{ maxHeight: 140 }}>
                  {(selected.users || []).map((uid) => {
                    const u = usersById[uid];
                    return (
                      <li key={uid} style={{ cursor: 'default' }}>
                        <strong>{u?.displayName || '—'}</strong>
                        <span>{u?.email || uid}</span>
                        <span className="muted small">
                          {u?.kinship || '—'} / {u?.cause || '—'}
                          {u?.chatDisabled ? ' · chat disabled' : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="drawer-actions">
                <button type="button" className="admin-btn" onClick={openViewer}>
                  Open Message Viewer
                </button>
              </div>

              <div className="drawer-section">
                <h4>Assign to RA</h4>
                <p className="muted">
                  Internal only. Participants never see who is assigned.
                </p>
                <label className="admin-assign-label">
                  Assigned to
                  <select
                    value={selected.assignedToUid || ''}
                    onChange={(e) => applyAssign(e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {adminUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName || u.email || u.uid}
                      </option>
                    ))}
                  </select>
                </label>
                {selected.assignedByName ? (
                  <p className="muted small">
                    Set by {selected.assignedByName}
                    {selected.assignedAt ? ` · ${tsToLocal(selected.assignedAt)}` : ''}
                  </p>
                ) : null}
              </div>

              <AdminMemoSection
                notes={selected.adminNotes}
                notify={notify}
                onSave={async (text) => {
                  const result = await addConversationNote(selected.docID, text);
                  const next = result?.conversation;
                  setConvos((prev) =>
                    prev.map((c) =>
                      c.docID === selected.docID
                        ? { ...c, ...(next || {}), adminNotes: next?.adminNotes || c.adminNotes }
                        : c
                    )
                  );
                }}
              />

              <div className="drawer-section">
                <h4>Monitoring</h4>
                <p className="muted">
                  Pin or flag for review without pausing the match. Flagging high-priority
                  conversations emails the study team.
                </p>
                <div className="drawer-actions">
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() =>
                      applyMonitor(
                        { pinned: !selected.pinned },
                        selected.pinned ? 'Conversation unpinned.' : 'Conversation pinned.'
                      )
                    }
                  >
                    {selected.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() =>
                      applyMonitor(
                        { needsReview: !selected.needsReview },
                        selected.needsReview
                          ? 'Review flag cleared.'
                          : 'Marked as needing review.'
                      )
                    }
                  >
                    {selected.needsReview ? 'Clear review flag' : 'Flag for review'}
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() =>
                      applyMonitor(
                        { highPriority: !selected.highPriority },
                        selected.highPriority
                          ? 'High priority cleared.'
                          : 'Marked high priority. Study team notified.'
                      )
                    }
                  >
                    {selected.highPriority ? 'Clear high priority' : 'Mark high priority'}
                  </button>
                </div>
              </div>

              {selected.type !== 'support' &&
                !(Array.isArray(selected.users) && selected.users.includes(getSupportUid())) && (
                <div className="drawer-section">
                  <h4>Pause / terminate</h4>
                  <p className="muted">
                    Stops both participants from sending new messages. Does not remove their Simpatico Match.
                  </p>
                  <div className="drawer-actions">
                    {moderationStatusOf(selected) !== 'paused' &&
                      moderationStatusOf(selected) !== 'terminated' && (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() =>
                            applyModeration(
                              'paused',
                              'Pause this conversation? Both participants will be unable to send new messages until you resume it.',
                              'Pause'
                            )
                          }
                        >
                          Pause Conversation
                        </button>
                      )}
                    {moderationStatusOf(selected) === 'paused' && (
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() =>
                          applyModeration(
                            'active',
                            'Resume this conversation? Both participants will be able to send messages again.',
                            'Resume'
                          )
                        }
                      >
                        Resume Conversation
                      </button>
                    )}
                    {moderationStatusOf(selected) !== 'terminated' && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        onClick={() =>
                          applyModeration(
                            'terminated',
                            'End this conversation? Both participants will be unable to send new messages. This does not unmatch them.',
                            'Terminate'
                          )
                        }
                      >
                        Terminate Conversation
                      </button>
                    )}
                    {moderationStatusOf(selected) === 'terminated' && (
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() =>
                          applyModeration(
                            'active',
                            'Reopen this conversation? Both participants will be able to send messages again. This does not change their Simpatico Match.',
                            'Reopen'
                          )
                        }
                      >
                        Reopen Conversation
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {showViewer && selected && (
        <ConvoViewer
          convoId={selected.docID}
          participants={selected.users || []}
          usersById={usersById}
          notify={notify}
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  );
}
