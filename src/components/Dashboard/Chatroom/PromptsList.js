import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPrompts, trackPromptEvent } from '../../../services/matchService';
import { PROMPT_CATEGORIES } from '../../../constants/prompts';
import GettingStartedIntro from './GettingStartedIntro';

const impressedSession = new Set();

export default function PromptsList({
  activeConversation,
  onInsertStarter,
  isMatched = false,
  showGettingStarted = false,
  onDismissGettingStarted,
}) {
  const [mode, setMode] = useState('starter'); // 'starter' | 'idea'
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIdeaId, setExpandedIdeaId] = useState(null);
  const listedIdsRef = useRef('');

  const canPaste = !!activeConversation?.docID;
  const showBank = canPaste || !isMatched;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getPrompts();
        if (!cancelled) setPrompts(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Could not load prompts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setExpandedIdeaId(null);
  }, [mode]);

  const byCategory = useMemo(() => {
    const filtered = prompts.filter((p) => p.mode === mode && p.active !== false);
    return PROMPT_CATEGORIES.map((c) => ({
      key: c.value,
      label: c.label,
      items: filtered
        .filter((p) => p.category === c.value)
        .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
    })).filter((row) => row.items.length > 0);
  }, [prompts, mode]);

  // Impressions: once per prompt id per browser session when chips are shown
  useEffect(() => {
    if (!showBank || loading || byCategory.length === 0) return;
    const ids = byCategory.flatMap((row) => row.items.map((p) => p.id)).filter(Boolean);
    const key = `${mode}:${ids.join(',')}`;
    if (key === listedIdsRef.current) return;
    listedIdsRef.current = key;
    ids.forEach((id) => {
      if (impressedSession.has(id)) return;
      impressedSession.add(id);
      trackPromptEvent(id, 'impression');
    });
  }, [showBank, loading, byCategory, mode]);

  const handleChipClick = useCallback(
    (prompt) => {
      if (!canPaste) {
        if (prompt.mode === 'idea') {
          setExpandedIdeaId((prev) => (prev === prompt.id ? null : prompt.id));
        }
        return;
      }
      trackPromptEvent(prompt.id, 'click');
      if (prompt.mode === 'starter') {
        onInsertStarter?.(prompt.text, prompt.id);
        return;
      }
      setExpandedIdeaId((prev) => (prev === prompt.id ? null : prompt.id));
    },
    [canPaste, onInsertStarter]
  );

  return (
    <div className="prompts-list">
      <div className="prompts-scroll">
        {isMatched && showGettingStarted && (
          <GettingStartedIntro onDismiss={onDismissGettingStarted} />
        )}

        {!showBank && !showGettingStarted && (
          <div className="prompts-empty">
            <p>Open a conversation to use prompts.</p>
          </div>
        )}

        {showBank && (
          <>
            <div className="prompts-list-header">
              <div className="prompts-mode-toggle" role="tablist" aria-label="Prompt type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'starter'}
                  className={mode === 'starter' ? 'active' : ''}
                  onClick={() => setMode('starter')}
                >
                  Starters
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'idea'}
                  className={mode === 'idea' ? 'active' : ''}
                  onClick={() => setMode('idea')}
                >
                  Ideas
                </button>
              </div>

              <p className="prompts-hint">
                {!canPaste
                  ? 'You can read these while you wait for a match. After you are matched, open the conversation and tap a starter to add it to a message.'
                  : mode === 'starter'
                    ? 'Optional suggestions — tap one to add it to your message, edit if you like, then send. You can also write your own.'
                    : 'Ideas stay here to spark what you write. They are not pasted into the message box.'}
              </p>

              {loading && <p className="prompts-status">Loading…</p>}
              {error && <p className="prompts-status prompts-error">{error}</p>}
              {!loading && !error && byCategory.length === 0 && (
                <p className="prompts-status">No prompts yet.</p>
              )}
            </div>

            <div className="prompts-categories">
              {byCategory.map((row) => (
                <section key={row.key} className="prompts-category">
                  <h4 className="prompts-category-title">{row.label}</h4>
                  <div className="prompts-chip-stack">
                    {row.items.map((p) => {
                      const expanded = mode === 'idea' && expandedIdeaId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`prompts-chip ${expanded ? 'expanded' : ''}`}
                          onClick={() => handleChipClick(p)}
                        >
                          {p.text}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
