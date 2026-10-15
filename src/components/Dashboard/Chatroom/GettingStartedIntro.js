import React, { useState } from 'react';

/**
 * Holly / Center "Share Pairs: Getting Started" — lives in the Prompts panel only.
 */
export default function GettingStartedIntro({ onDismiss }) {
  const [busy, setBusy] = useState(false);

  const handleDismiss = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDismiss?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="getting-started-intro">
      <h3 className="getting-started-title">Share Pairs: Getting Started</h3>
      <p>
        You’ve been paired with someone who has also experienced a significant
        loss. You can share as much or as little as feels right. There’s no
        agenda — just a chance to talk with someone who understands grief from
        the inside.
      </p>

      <p>
        <b>How to begin.</b> You might start with something simple. Use the
        starters below — tap one to place it in your message box, edit it, or
        write your own. For example: “How has your week been feeling?”
      </p>

      <p>
        <b>If the conversation feels comfortable.</b> You can explore changes in
        relationships; what’s been helpful or hurtful from family, friends, or
        coworkers; and how routines, holidays, or work have shifted.
      </p>

      <p>
        <b>Talking about the loss (optional).</b> Only if you want to, you may
        share who died and what they meant to you, how the death occurred, or
        what you think about most these days.
      </p>

      <p>
        <b>Emotional experiences.</b> It’s okay to talk about emotions that show
        up — including ones that surprise you. You can also share what helps you
        get through harder moments.
      </p>

      <p>
        <b>Closing.</b> You might note it was nice to meet them and you look
        forward to talking again soon (if that feels true). If not, a simple
        “Goodbye” or “See you soon” is fine.
      </p>

      {onDismiss && (
        <button
          type="button"
          className="getting-started-dismiss"
          onClick={handleDismiss}
          disabled={busy}
        >
          {busy ? 'Saving…' : 'Got it'}
        </button>
      )}
    </div>
  );
}
