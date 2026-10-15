import React, { useCallback, useEffect, useState } from 'react';
import SystemMessage from '../../SystemMessage/SystemMessage';
import { useAuth } from '../../UserAuth/AuthContext';
import { getMyAssessments, getAssessment, saveAssessment, submitAssessment } from '../../../services/assessmentService';
import en from '../../../translations/en';
import '../Profile/profile.css';
import './assessments.css';

const STATUS_ORDER = { overdue: 0, due: 1, upcoming: 2, complete: 3 };

function itemIsVisible(item, responses) {
  if (!item?.showIf) return true;
  return String(responses?.[item.showIf.id] ?? '') === String(item.showIf.equals);
}

function itemOptions(item, instrument) {
  if (Array.isArray(item?.options) && item.options.length) return item.options;
  return instrument?.likertOptions || [];
}

export default function AssessmentsPage() {
  const t = en.assessments;
  const { refreshAuth } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [responses, setResponses] = useState({});
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [message, setMessage] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const list = await getMyAssessments();
      const rows = Array.isArray(list) ? list : [];
      rows.sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
          Number(a.dueAt || 0) - Number(b.dueAt || 0)
      );
      setAssignments(rows);
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || t.error });
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openAssignment = async (id) => {
    setSaving(false);
    try {
      const data = await getAssessment(id);
      setDetail(data);
      setResponses(data?.assignment?.responses || {});
      setActiveId(id);
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || t.error });
    }
  };

  const setResponse = (itemId, value) => {
    setResponses((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeId) return;
    setSaving(true);
    try {
      await submitAssessment(activeId, responses);
      await refreshAuth?.();
      setMessage({ type: 'info', text: t.submitted });
      setActiveId(null);
      setDetail(null);
      await loadList();
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || t.error });
    } finally {
      setSaving(false);
    }
  };

  const assignment = detail?.assignment;
  const instrument = detail?.instrument;
  const canComplete =
    assignment &&
    assignment.status !== 'complete' &&
    assignment.status !== 'upcoming' &&
    !instrument?.contentPending &&
    !instrument?.scalePending &&
    !assignment?.held &&
    Array.isArray(instrument?.items) &&
    instrument.items.length > 0;

  const handleSave = async () => {
    if (!activeId || saving || savingDraft) return;
    setSavingDraft(true);
    try {
      if (canComplete) {
        await saveAssessment(activeId, responses);
        await refreshAuth?.();
      }
      setMessage({ type: 'info', text: t.saved });
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || t.error });
    } finally {
      setSavingDraft(false);
    }
  };

  const renderItem = (item) => {
    if (!itemIsVisible(item, responses)) return null;
    if (item.type === 'info') {
      return (
        <p key={item.id} className="assessment-info">
          {item.text}
        </p>
      );
    }
    const prompt = item.text;
    if (item.type === 'textarea') {
      return (
        <label key={item.id} className="assessment-item">
          <span>{prompt}</span>
          <textarea
            rows={4}
            value={responses[item.id] || ''}
            onChange={(e) => setResponse(item.id, e.target.value)}
            required={!item.optional && String(responses[item.id] || '').trim() === ''}
          />
        </label>
      );
    }
    if (item.type === 'text') {
      return (
        <label key={item.id} className="assessment-item">
          <span>{prompt}</span>
          <input
            type="text"
            value={responses[item.id] || ''}
            onChange={(e) => setResponse(item.id, e.target.value)}
            required={!item.optional && String(responses[item.id] || '').trim() === ''}
          />
        </label>
      );
    }

    const options = itemOptions(item, instrument);
    const selected = String(responses[item.id] || '');
    const showOther = Boolean(item.otherOption && selected === String(item.otherOption));
    return (
      <fieldset key={item.id} className="assessment-item">
        <legend>{prompt}</legend>
        <div className="assessment-likert">
          {options.map((opt) => (
            <label key={opt.value} className="assessment-choice">
              <input
                type="radio"
                name={item.id}
                value={opt.value}
                checked={selected === String(opt.value)}
                onChange={(e) => setResponse(item.id, e.target.value)}
                required={!item.optional && selected.trim() === ''}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {showOther && item.otherId ? (
          <label className="assessment-other">
            <span>Specify</span>
            <input
              type="text"
              value={responses[item.otherId] || ''}
              onChange={(e) => setResponse(item.otherId, e.target.value)}
              required={!item.otherOptional && String(responses[item.otherId] || '').trim() === ''}
            />
          </label>
        ) : null}
      </fieldset>
    );
  };

  const pendingMessage = instrument?.scalePending
    ? t.scalePending
    : t.pendingContent;

  return (
    <div className="profile-page assessments-page">
      {message && (
        <SystemMessage
          message={message.text}
          type={message.type}
          cancelMessage={() => setMessage(null)}
        />
      )}
      <header className="profile-page-header">
        <h2>{t.title}</h2>
        <p>{t.subtitle}</p>
      </header>

      {activeId && detail ? (
        <div className="assessment-detail">
          <button type="button" className="assessment-back" onClick={() => setActiveId(null)}>
            {t.back}
          </button>
          <div className="assessment-sheet">
            <p className="assessment-kicker">{assignment?.timePointLabel}</p>
            <h3>{instrument?.title || assignment?.instrumentTitle}</h3>
            {instrument?.description ? <p className="assessment-desc">{instrument.description}</p> : null}
            {assignment?.status === 'complete' ? (
              <p className="assessment-note">This questionnaire is complete. The questions are below.</p>
            ) : null}
            {assignment?.status === 'upcoming' ? (
              <p className="assessment-note">{t.notYetAvailable}</p>
            ) : null}
            {instrument?.scalePending ? <p className="assessment-note">{t.scalePending}</p> : null}
            {instrument?.items?.length ? (
              <form className="assessment-form" onSubmit={handleSubmit}>
                <fieldset disabled={!canComplete} className="assessment-fields">
                  {instrument.items.map((item) => renderItem(item))}
                </fieldset>
                <div className="assessment-actions">
                  <button
                    type="button"
                    className="assessment-save"
                    onClick={handleSave}
                    disabled={saving || savingDraft}
                  >
                    {savingDraft ? t.saving : t.save}
                  </button>
                  {canComplete && (
                    <button type="submit" className="assessment-submit" disabled={saving || savingDraft}>
                      {saving ? t.submitting : t.submit}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <p className="assessment-note">{pendingMessage}</p>
            )}
          </div>
        </div>
      ) : (
        <ul className="assessment-list">
          {loading ? (
            <li className="assessment-empty">Loading…</li>
          ) : assignments.length === 0 ? (
            <li className="assessment-empty">{t.empty}</li>
          ) : (
            assignments.map((a) => (
              <li key={a.id}>
                <button type="button" className="assessment-row" onClick={() => openAssignment(a.id)}>
                  <span className={`assessment-status is-${a.status}`}>
                    {t[a.status] || a.status}
                  </span>
                  <span className="assessment-row-copy">
                    <strong>{a.instrumentTitle}</strong>
                    <span className="assessment-row-meta">{a.timePointLabel}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
