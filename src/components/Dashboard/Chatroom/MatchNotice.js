import React, { useState } from 'react';
import '../welcomemessage.css';

/**
 * Shown once to each participant after an admin creates their match.
 * Email is sent separately and may not be deliverable yet.
 */
export default function MatchNotice({ userData, onDismiss }) {
  const [busy, setBusy] = useState(false);
  const match = userData?.simpaticoMatch;
  const partner =
    (match && typeof match === 'object' && (match.displayName || match.display_name)) ||
    'another participant';

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
    <div className="welcome-message" role="dialog" aria-labelledby="match-notice-title">
      <div className="header">
        <div className="header-text">
          <p id="match-notice-title"><strong>You have a Simpatico Match</strong></p>
        </div>
      </div>
      <div className="body">
        <p>
          You have been paired with <strong>{partner}</strong>. They are in your Contacts list.
          You can open that contact when you are ready to talk.
        </p>
        <button
          type="button"
          className="match-notice-ok"
          onClick={handleDismiss}
          disabled={busy}
        >
          {busy ? 'Saving…' : 'OK'}
        </button>
      </div>
    </div>
  );
}
