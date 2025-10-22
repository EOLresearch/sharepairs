import './chatmessage.css';

export default function ChatMessage({ message, currentUserId }) {
  if (!message) return null;

  const isSentByCurrentUser = message.sentFromUid === currentUserId;
  const msgStyle = isSentByCurrentUser ? 'sent' : 'received';

  // Keep your timestamp logic but make it a bit more robust
  const ts =
    message.createdAt?.toDate?.() ??
    (message.createdAt?.seconds ? new Date(message.createdAt.seconds * 1000) : null) ??
    message.timestamp?.toDate?.() ??
    (message.timestamp?.seconds ? new Date(message.timestamp.seconds * 1000) : null);

  const timestamp = ts ? ts.toLocaleString() : '--';

  return (
    <div className={`message ${msgStyle}`}>
      <div className="msg-inner-container">
        <p>
          {message.body}
          <br />
          <span className="subscript">
            {message.sentFromDisplayName} — {timestamp}
          </span>
        </p>
        {/* {message.photoURL && (
          <img className="avatar" src={message.photoURL} alt="User avatar" />
        )} */}
      </div>
    </div>
  );
}
