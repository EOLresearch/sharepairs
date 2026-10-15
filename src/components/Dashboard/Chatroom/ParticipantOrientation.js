import React, { useState } from 'react';
import '../welcomemessage.css';
import './orientation.css';

const sharePairsLogo = `${process.env.PUBLIC_URL}/sharepairslogo.png`;

/**
 * First-time orientation shown after a participant is matched,
 * before they enter peer chat. Completing it sets hasSeenMatch=true.
 * Copy adapted from Holly Prigerson / Center "Share Pairs: Getting Started".
 * Layout mirrors WelcomeMessage.
 */
export default function ParticipantOrientation({ userData, onBegin }) {
  const [busy, setBusy] = useState(false);
  const name = userData?.displayName || 'there';

  const handleBegin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onBegin?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="welcome-message orientation-card"
      role="dialog"
      aria-labelledby="orientation-title"
    >
      <div className="header">
        <div className="image-container">
          <img className="profile-image" alt="Share Pairs logo" src={sharePairsLogo} />
        </div>
        <div className="header-text">
          <p>
            <strong>Hello, {name}</strong>
          </p>
          <p id="orientation-title">Share Pairs: Getting Started</p>
        </div>
      </div>

      <div className="body orientation-body">
        <p>
          You’ve been paired with someone who has also experienced a significant
          loss. You can share as much or as little as feels right. There’s no
          agenda — just a chance to talk with someone who understands grief from
          the inside.
        </p>

        <div className="side-instructions orientation-block">
          <p>
            <b>How to begin</b>
            <br />
            You might start with something simple. Optional prompts are in the
            chat — tap one to place it in your message box, edit it, or write
            your own.
            <br />
            “How has your week been feeling?”
            <br />
            “Have interactions with people felt different since your loss?”
            <br />
            “Has anything someone said or did stayed with you?”
          </p>
        </div>

        <div className="side-instructions orientation-block">
          <p>
            <b>If the conversation feels comfortable</b>
            <br />
            You can explore changes in relationships; what’s been helpful or
            hurtful from family, friends, or coworkers; and how routines,
            holidays, or work have shifted.
          </p>
        </div>

        <div className="side-instructions orientation-block">
          <p>
            <b>Talking about the loss (optional)</b>
            <br />
            Only if you want to, you may share who died and what they meant to
            you, how the death occurred, or what you think about most these days.
          </p>
        </div>

        <div className="side-instructions orientation-block">
          <p>
            <b>Emotional experiences</b>
            <br />
            It’s okay to talk about emotions that show up — including ones that
            surprise you. You can also share what helps you get through harder
            moments.
          </p>
        </div>

        <div className="side-instructions orientation-block">
          <p>
            <b>Closing the conversation</b>
            <br />
            You might note it was nice to meet them and you look forward to
            talking again soon (if that feels true). If not, a simple “Goodbye”
            or “See you soon” is fine.
          </p>
        </div>

        <div className="orientation-actions">
          <button
            type="button"
            className="orientation-begin-btn"
            onClick={handleBegin}
            disabled={busy}
          >
            {busy ? 'Starting…' : 'Begin Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}
