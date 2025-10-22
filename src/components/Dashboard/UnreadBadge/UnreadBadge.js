import React from 'react';
import './UnreadBadge.css';

export default function UnreadBadge({ isConvo }) {
  return (
    <div className="unread-badge-wrapper">
      <div className="unread-badge"></div>
      {isConvo && <p className="unread-label">Unread Messages</p>}
    </div>
  );
}
