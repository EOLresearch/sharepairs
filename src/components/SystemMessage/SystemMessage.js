import './systemmessage.css';

export default function SystemMessage({
  message,
  cancelMessage,
  type = 'info',
  onClick = null,
  actionLabel = 'OK', // default label
}) {
  const handleAction = async () => {
    try {
      if (onClick) {
        await onClick();
      }
    } catch (err) {
      console.error('SystemMessage action failed:', err);
      return; // leave message up so error replacement (if any) can show
    }
    // Always dismiss after a successful OK (action may also clear)
    cancelMessage?.();
  };

  return (
    <div className={`system-message ${type}`}>
      <p>{message}</p>
      <div className="system-message-buttons">
        <button type="button" className="system-btn action-btn" onClick={handleAction}>
          {actionLabel}
        </button>
        <button type="button" className="system-btn cancel-btn" onClick={cancelMessage}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
