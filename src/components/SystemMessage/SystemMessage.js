import './systemmessage.css';

export default function SystemMessage({
  message,
  cancelMessage,
  type = 'info',
  onClick = null,
  actionLabel = 'OK', // default label
}) {
  return (
    <div className={`system-message ${type}`}>
      <p>{message}</p>
      <div className="system-message-buttons">
        {onClick && (
          <button className="system-btn action-btn" onClick={onClick}>
            {actionLabel}
          </button>
        )}
        <button className="system-btn cancel-btn" onClick={cancelMessage}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
