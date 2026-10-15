import React, { useEffect, useMemo, useState } from 'react';
import { getAdminAssessments, saveStaffCssrs } from '../../services/assessmentService';

function itemVisible(item, responses) {
  if (!item?.showIf) return true;
  return String(responses?.[item.showIf.id] ?? '') === String(item.showIf.equals);
}

function participantLabel(user) {
  return user.displayName || user.display_name || user.email || user.uid;
}

export default function CssrsScreeningForm({ usersById, instrument, notify, onSaved }) {
  const [uid, setUid] = useState('');
  const [responses, setResponses] = useState({});
  const [reference, setReference] = useState('');
  const [existing, setExisting] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const participants = useMemo(() => {
    return Object.values(usersById || {})
      .filter((user) => user?.uid && !user.admin && !user.is_admin)
      .sort((a, b) => participantLabel(a).localeCompare(participantLabel(b)));
  }, [usersById]);

  useEffect(() => {
    let cancelled = false;
    if (!uid) {
      setExisting(null);
      setResponses({});
      setReference('');
      return undefined;
    }
    setLoadingExisting(true);
    getAdminAssessments({ uid, includeResponses: true })
      .then((rows) => {
        if (cancelled) return;
        const row = (rows || []).find((item) => item.instrumentId === 'cssrs_screening');
        setExisting(row || null);
        setResponses(row?.responses && typeof row.responses === 'object' ? { ...row.responses } : {});
        setReference(row?.screenerReference || '');
      })
      .catch(() => {
        if (!cancelled) notify?.('Could not load this participant’s C-SSRS.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, notify]);

  const setAnswer = (id, value) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if (!uid) {
      notify?.('Choose the enrolled participant first.', 'error');
      return;
    }
    const visible = (instrument?.items || []).filter((item) => itemVisible(item, responses));
    const missing = visible.find((item) => !String(responses[item.id] || '').trim());
    if (missing) {
      notify?.('Answer every visible C-SSRS question before saving.', 'error');
      return;
    }
    const payload = {};
    visible.forEach((item) => {
      payload[item.id] = responses[item.id];
    });
    setSaving(true);
    try {
      const result = await saveStaffCssrs(uid, payload, reference);
      const status = result?.assignment?.redcapExportStatus || 'saved';
      notify?.(`C-SSRS saved on this participant. REDCap export: ${status}.`, 'info');
      setExisting(result?.assignment || existing);
      onSaved?.();
    } catch (err) {
      notify?.(err.message || 'C-SSRS save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cssrs-entry">
      <h3>C-SSRS screening</h3>
      <p className="muted">
        Enter the Zoom-administered screening on the enrolled participant. This links those
        answers to their study record and sends them through the same REDCap export as other
        assessments. The anonymous screener stays separate and is not imported.
      </p>
      <label>
        Enrolled participant
        <select value={uid} onChange={(e) => setUid(e.target.value)}>
          <option value="">Select participant</option>
          {participants.map((user) => (
            <option key={user.uid} value={user.uid}>
              {participantLabel(user)}
              {user.email ? ` (${user.email})` : ''}
            </option>
          ))}
        </select>
      </label>
      {uid && loadingExisting ? <p className="muted">Loading saved answers…</p> : null}
      {existing?.completedAt ? (
        <p className="muted">
          Already on this study record. Saving again replaces the stored answers.
          {existing.redcapExportStatus ? ` REDCap: ${existing.redcapExportStatus}.` : ''}
        </p>
      ) : null}
      {(instrument?.items || []).map((item) => {
        if (!itemVisible(item, responses)) return null;
        return (
          <fieldset key={item.id} className="cssrs-q">
            <legend>{item.text}</legend>
            <div className="cssrs-choices">
              {(item.options || []).map((opt) => (
                <label key={opt.value} className="cssrs-choice">
                  <input
                    type="radio"
                    name={item.id}
                    value={opt.value}
                    checked={responses[item.id] === opt.value}
                    onChange={() => setAnswer(item.id, opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <label>
        Anonymous screener reference (optional)
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="ID from the anonymous screener, if you have one"
        />
      </label>
      <p className="muted">
        A reference only notes which anonymous screener this enrollment came from. It does not
        copy that screener into the study record.
      </p>
      <div className="drawer-actions">
        <button type="button" className="admin-btn" onClick={handleSave} disabled={saving || !uid}>
          {saving ? 'Saving…' : 'Save C-SSRS on study record'}
        </button>
      </div>
    </section>
  );
}
