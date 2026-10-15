import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllUsers } from '../../services/matchService';
import {
  getAdminAssessments,
  getAdminInstruments,
  getAdminSchedule,
  saveAdminSchedule,
  assignAssessments,
  retryRedcapExport,
} from '../../services/assessmentService';
import CssrsScreeningForm from './CssrsScreeningForm';

const STATUS_OPTIONS = ['all', 'overdue', 'due', 'upcoming', 'complete'];
const EXPORT_OPTIONS = ['all', 'unconfigured', 'pending', 'sent', 'failed'];

function formatWhen(ts) {
  if (!ts) return '—';
  const n = Number(ts);
  if (!Number.isFinite(n) || !n) return '—';
  return new Date(n > 1e12 ? n : n * 1000).toLocaleString();
}

function heldNote(assignment) {
  if (!assignment?.held) return '';
  return assignment.heldReason || 'Held — scale or items not confirmed';
}

export default function AssessmentsTab({ notify, userData }) {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportFilter, setExportFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [assignUid, setAssignUid] = useState('');
  const [saving, setSaving] = useState(false);
  const [retryingId, setRetryingId] = useState('');
  const [timePointsText, setTimePointsText] = useState('');
  const [dueGraceDays, setDueGraceDays] = useState(7);
  const [reminderIntervalDays, setReminderIntervalDays] = useState(3);

  const refresh = useCallback(
    async ({ quiet } = {}) => {
      try {
        if (!quiet) setLoading(true);
        const [list, inst, sched, users] = await Promise.all([
          getAdminAssessments(),
          getAdminInstruments(),
          getAdminSchedule(),
          getAllUsers(),
        ]);
        setAssignments(Array.isArray(list) ? list : []);
        setInstruments(Array.isArray(inst) ? inst : []);
        setSchedule(sched || null);
        const map = {};
        (Array.isArray(users) ? users : []).forEach((d) => {
          const uid = d.uid ?? d.id;
          if (uid) map[uid] = { uid, ...d };
        });
        setUsersById(map);
        if (sched) {
          setTimePointsText(JSON.stringify(sched.timePoints || [], null, 2));
          setDueGraceDays(Number(sched.dueGraceDays || 7));
          setReminderIntervalDays(Number(sched.reminderIntervalDays || 3));
        }
      } catch (err) {
        console.error(err);
        notify?.('Failed to load assessments.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    if (!userData?.admin) return;
    refresh();
  }, [userData?.admin, refresh]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (exportFilter !== 'all' && (a.redcapExportStatus || '') !== exportFilter) return false;
      if (!s) return true;
      const u = usersById[a.uid];
      return (
        String(a.uid || '').toLowerCase().includes(s) ||
        String(a.instrumentTitle || '').toLowerCase().includes(s) ||
        String(a.timePointLabel || '').toLowerCase().includes(s) ||
        u?.displayName?.toLowerCase?.().includes(s) ||
        u?.email?.toLowerCase?.().includes(s)
      );
    });
  }, [assignments, statusFilter, exportFilter, search, usersById]);

  const handleRetry = async (assignment) => {
    if (!assignment?.id) return;
    setRetryingId(assignment.id);
    try {
      const result = await retryRedcapExport(assignment.id);
      const status = result?.assignment?.redcapExportStatus || result?.redcapExportStatus || 'unknown';
      notify?.(`REDCap export status: ${status}. Participant responses were not changed.`, 'info');
      await refresh({ quiet: true });
    } catch (err) {
      notify?.(err.message || 'REDCap retry failed.', 'error');
    } finally {
      setRetryingId('');
    }
  };

  const saveSchedule = async () => {
    let timePoints;
    try {
      timePoints = JSON.parse(timePointsText || '[]');
      if (!Array.isArray(timePoints)) throw new Error('Time points must be an array');
    } catch (err) {
      notify?.(err.message || 'Time points must be valid JSON.', 'error');
      return;
    }
    setSaving(true);
    try {
      const next = await saveAdminSchedule({
        timePoints,
        dueGraceDays: Number(dueGraceDays),
        reminderIntervalDays: Number(reminderIntervalDays),
      });
      setSchedule(next);
      notify?.('Assessment schedule saved.', 'success');
    } catch (err) {
      notify?.(err.message || 'Could not save schedule.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    const uid = assignUid.trim();
    if (!uid) {
      notify?.('Enter a participant UID.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await assignAssessments(uid);
      notify?.(
        `Assigned ${result?.created ?? 0} new assessment(s). Existing ones were left in place.`,
        'success'
      );
      setAssignUid('');
      await refresh({ quiet: true });
    } catch (err) {
      notify?.(err.message || 'Assign failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="assessments-tab users-tab">
      <div className="users-controls">
        <input
          type="text"
          className="admin-search"
          placeholder="Search name, email, UID, instrument"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Any' : s}
              </option>
            ))}
          </select>
        </label>
        <label>
          REDCap
          <select value={exportFilter} onChange={(e) => setExportFilter(e.target.value)}>
            {EXPORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Any export' : s}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => refresh()} disabled={loading}>
          Refresh
        </button>
        <span className="users-count">
          {loading ? 'Loading…' : `${filtered.length} of ${assignments.length}`}
        </span>
      </div>

      <div className="users-content assessments-admin-layout">
        <div className="users-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Instrument</th>
                <th>Time point</th>
                <th>Due</th>
                <th>Status</th>
                <th>REDCap</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const u = usersById[a.uid];
                const pillCls =
                  a.status === 'complete'
                    ? 'pill-ok'
                    : a.status === 'overdue'
                      ? 'pill-warn'
                      : a.status === 'due'
                        ? 'pill-review'
                        : 'pill-pin';
                const exportStatus = a.redcapExportStatus || '—';
                const exportCls =
                  exportStatus === 'sent'
                    ? 'pill-ok'
                    : exportStatus === 'failed'
                      ? 'pill-warn'
                      : exportStatus === 'pending'
                        ? 'pill-review'
                        : 'pill-pin';
                const canRetry = a.status === 'complete' && a.id;
                return (
                  <tr key={a.id}>
                    <td>
                      {u?.displayName || u?.email || a.uid}
                      <div className="muted small">{u?.email || a.uid}</div>
                    </td>
                    <td>{a.instrumentTitle || a.instrumentId}</td>
                    <td>{a.timePointLabel || a.timePoint}</td>
                    <td>{formatWhen(a.dueAt)}</td>
                    <td>
                      <span className={`pill ${pillCls}`}>{a.status}</span>
                      {a.held ? (
                        <div className="muted small">{heldNote(a)}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`pill ${exportCls}`}>{exportStatus}</span>
                      {a.redcapExportError ? (
                        <div className="muted small">{a.redcapExportError}</div>
                      ) : null}
                    </td>
                    <td>
                      {canRetry ? (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => handleRetry(a)}
                          disabled={Boolean(retryingId) || saving}
                        >
                          {retryingId === a.id ? 'Retrying…' : 'Retry REDCap'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No assessments match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="user-drawer">
          <CssrsScreeningForm
            usersById={usersById}
            instrument={instruments.find((item) => item.id === 'cssrs_screening')}
            notify={notify}
            onSaved={() => refresh({ quiet: true })}
          />
          <header className="drawer-header">
            <h3>Schedule</h3>
            <p className="drawer-email">Configurable time points and reminders</p>
          </header>
          <p className="muted">
            Instruments: {instruments.map((i) => i.shortTitle || i.id).join(', ') || '—'}.
            Baseline is assigned at registration. C-SSRS screening is entered here by staff and is not shown to participants.
            INQ-15 is 15 items numbered 1–15, scored 1–7 (the printed duplicate 4 is removed).
          </p>
          <p className="muted">
            REDCap export stays <strong>unconfigured</strong> until the study team confirms
            the project mapping (<code>REDCAP_MAPPING_CONFIRMED</code>). Credentials alone
            do not send data. Retry uses stored responses and does not change answers.
          </p>
          <label>
            Due grace days
            <input
              type="number"
              min={0}
              value={dueGraceDays}
              onChange={(e) => setDueGraceDays(e.target.value)}
            />
          </label>
          <label>
            Reminder interval (days)
            <input
              type="number"
              min={1}
              value={reminderIntervalDays}
              onChange={(e) => setReminderIntervalDays(e.target.value)}
            />
          </label>
          <label>
            Time points (JSON)
            <textarea
              rows={12}
              value={timePointsText}
              onChange={(e) => setTimePointsText(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="drawer-actions">
            <button type="button" className="admin-btn" onClick={saveSchedule} disabled={saving}>
              {saving ? 'Saving…' : 'Save schedule'}
            </button>
          </div>
          <div className="drawer-section">
            <h4>Assign</h4>
            <p className="muted">
              Creates missing assignments from the current schedule using now as the anchor.
            </p>
            <input
              type="text"
              placeholder="Participant UID"
              value={assignUid}
              onChange={(e) => setAssignUid(e.target.value)}
            />
            <div className="drawer-actions">
              <button type="button" className="admin-btn" onClick={handleAssign} disabled={saving}>
                Assign from schedule
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
