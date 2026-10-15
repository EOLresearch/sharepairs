import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminPrompts,
  createAdminPrompt,
  updateAdminPrompt,
  deleteAdminPrompt,
} from '../../services/matchService';
import { PROMPT_CATEGORIES, PROMPT_MODES, PROMPT_CATEGORY_LABELS } from '../../constants/prompts';

const emptyForm = {
  text: '',
  mode: 'starter',
  category: 'greetings',
  active: true,
  sortOrder: 0,
};

export default function PromptsTab({ notify, confirm, userData }) {
  const [isLoading, setIsLoading] = useState(true);
  const [prompts, setPrompts] = useState([]);
  const [modeFilter, setModeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => prompts.find((p) => p.id === selectedId) || null,
    [prompts, selectedId]
  );

  const refresh = useCallback(
    async ({ quiet } = {}) => {
      try {
        if (!quiet) setIsLoading(true);
        const list = await getAdminPrompts();
        setPrompts(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error(err);
        notify?.('Failed to load prompts.', 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    if (!userData?.admin) return;
    refresh();
  }, [userData?.admin, refresh]);

  useEffect(() => {
    if (!selected) {
      setForm(emptyForm);
      return;
    }
    setForm({
      text: selected.text || '',
      mode: selected.mode || 'starter',
      category: selected.category || 'greetings',
      active: selected.active !== false,
      sortOrder: Number(selected.sortOrder ?? 0),
    });
  }, [selected]);

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      if (modeFilter !== 'all' && p.mode !== modeFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      return true;
    });
  }, [prompts, modeFilter, categoryFilter]);

  const startCreate = () => {
    setSelectedId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    const text = String(form.text || '').trim();
    if (!text) {
      notify?.('Prompt text is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        text,
        mode: form.mode,
        category: form.category,
        active: !!form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (selectedId) {
        await updateAdminPrompt(selectedId, payload);
        notify?.('Prompt updated.', 'info');
      } else {
        const res = await createAdminPrompt(payload);
        const id = res?.prompt?.id;
        notify?.('Prompt created.', 'info');
        await refresh({ quiet: true });
        if (id) setSelectedId(id);
        setSaving(false);
        return;
      }
      await refresh({ quiet: true });
    } catch (err) {
      console.error(err);
      notify?.(err.message || 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateAdminPrompt(selectedId, { active: !form.active });
      notify?.(form.active ? 'Prompt deactivated.' : 'Prompt activated.', 'info');
      await refresh({ quiet: true });
    } catch (err) {
      notify?.(err.message || 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    confirm?.({
      message: 'Delete this prompt permanently?',
      actionLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteAdminPrompt(selectedId);
          setSelectedId(null);
          notify?.('Prompt deleted.', 'info');
          await refresh({ quiet: true });
        } catch (err) {
          notify?.(err.message || 'Delete failed.', 'error');
        }
      },
    });
  };

  return (
    <div className="prompts-tab">
      <div className="users-controls">
        <label>
          Mode
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">All</option>
            {PROMPT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All</option>
            {PROMPT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="admin-primary-btn" onClick={startCreate}>
          New prompt
        </button>
        <button type="button" onClick={() => refresh()} disabled={isLoading}>
          Refresh
        </button>
      </div>

      <div className="prompts-layout">
        <div className="prompts-list-panel">
          {isLoading ? (
            <p className="admin-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-muted">No prompts match these filters.</p>
          ) : (
            <ul className="prompts-admin-list">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`prompts-admin-row ${selectedId === p.id ? 'selected' : ''} ${
                      p.active === false ? 'inactive' : ''
                    }`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="prompts-admin-meta">
                      {p.mode === 'idea' ? 'Idea' : 'Starter'} ·{' '}
                      {PROMPT_CATEGORY_LABELS[p.category] || p.category}
                      {p.active === false ? ' · inactive' : ''}
                    </span>
                    <span className="prompts-admin-text">{p.text}</span>
                    <span className="prompts-admin-stats">
                      Shown {Number(p.impressions || 0)} · Clicked{' '}
                      {Number(p.clicks || 0)} · Used {Number(p.sends || 0)}
                      {Number(p.impressions || 0) > 0
                        ? ` · ${(
                            (100 * Number(p.clicks || 0)) /
                            Number(p.impressions || 0)
                          ).toFixed(0)}% click`
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="prompts-editor-panel">
          <h3>{selectedId ? 'Edit prompt' : 'New prompt'}</h3>
          {selected && (
            <div className="prompts-analytics-box" aria-label="Prompt analytics">
              <strong>Usage</strong>
              <div className="prompts-analytics-grid">
                <span>
                  Impressions
                  <b>{Number(selected.impressions || 0)}</b>
                </span>
                <span>
                  Clicks
                  <b>{Number(selected.clicks || 0)}</b>
                </span>
                <span>
                  Sends
                  <b>{Number(selected.sends || 0)}</b>
                </span>
              </div>
              <p className="admin-muted">
                Impression = shown in chat · Click = selected · Send = inserted into
                the message box
              </p>
            </div>
          )}
          <label>
            Text
            <textarea
              rows={4}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Prompt text…"
            />
          </label>
          <div className="prompts-editor-row">
            <label>
              Mode
              <select
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              >
                {PROMPT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {PROMPT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort order
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </label>
          </div>
          <label className="prompts-active-check">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active (shown in chat)
          </label>
          <div className="prompts-editor-actions">
            <button type="button" className="admin-primary-btn" onClick={handleSave} disabled={saving}>
              {selectedId ? 'Save' : 'Create'}
            </button>
            {selectedId && (
              <>
                <button type="button" onClick={handleToggleActive} disabled={saving}>
                  {form.active ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" className="admin-danger-btn" onClick={handleDelete} disabled={saving}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
