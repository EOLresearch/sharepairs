import { useState } from 'react';
import './chatmessage.css';
import { reportMessage } from '../../../services/messageService';
import en from '../../../translations/en';
import BlurredText from './BlurredText';

export default function ChatMessage({
  message,
  currentUserId,
  conversationId,
  canReport = false,
  onReported,
  setSystemMessage,
}) {
  const t = en.report;
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  if (!message) return null;

  const isSentByCurrentUser = message.sentFromUid === currentUserId;
  const msgStyle = isSentByCurrentUser ? 'sent' : 'received';
  const reported = Boolean(message.reportedByMe);
  const showReport = canReport && !isSentByCurrentUser;

  const ts =
    message.createdAt?.toDate?.() ??
    (message.createdAt?.seconds ? new Date(message.createdAt.seconds * 1000) : null) ??
    message.timestamp?.toDate?.() ??
    (message.timestamp?.seconds ? new Date(message.timestamp.seconds * 1000) : null);

  const timestamp = ts ? ts.toLocaleString() : '--';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = explanation.trim();
    if (text.length < 3) {
      setSystemMessage?.({ type: 'alert', message: t.needExplanation });
      return;
    }
    setSaving(true);
    try {
      const result = await reportMessage(conversationId, message.mid || message.id, text);
      onReported?.(result?.message || { ...message, reportedByMe: true });
      setOpen(false);
      setExplanation('');
      setSystemMessage?.({
        type: 'info',
        message: t.submitted,
      });
    } catch (err) {
      setSystemMessage?.({
        type: 'alert',
        message: err?.message || t.error,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`message ${msgStyle}${reported ? ' is-reported' : ''}`}>
      <div className="msg-inner-container">
        <p>
          <BlurredText text={message.body} />
          <br />
          <span className="subscript">
            {message.sentFromDisplayName} — {timestamp}
          </span>
        </p>
        {showReport && (
          <div className="msg-report">
            {reported ? (
              <span className="msg-report-done">{t.reported}</span>
            ) : open ? (
              <form className="msg-report-form" onSubmit={handleSubmit}>
                <label htmlFor={`report-${message.mid || message.id}`}>{t.prompt}</label>
                <textarea
                  id={`report-${message.mid || message.id}`}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={t.placeholder}
                  disabled={saving}
                />
                <div className="msg-report-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? t.sending : t.submit}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} disabled={saving}>
                    {t.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="msg-report-btn" onClick={() => setOpen(true)}>
                {t.action}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
