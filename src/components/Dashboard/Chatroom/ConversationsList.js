import React, { useState, useEffect } from 'react';
import { RxCaretRight } from "react-icons/rx";
import { IconContext } from 'react-icons';
import UnreadBadge from '../UnreadBadge/UnreadBadge';

function ConversationsList({
  conversations,
  currentUserId,
  handleConversationClick,
  initialMessages,
  setSystemMessage,
  hasUnread,
  setActiveConversation,
  activeConversation
}) {
  const [unreadCounts, setUnreadCounts] = useState({});

  const handleClose = (e) => {
    e.stopPropagation();           // don’t trigger the open click
    setActiveConversation(null); // clear the active convo
  };

  return (
    <IconContext.Provider value={{ className: "react-icons-contacts" }}>
      <div className="contacts-list">
        {conversations.map((conversation) => {
          const { docID, userData, createdAt } = conversation;

          const sender = userData?.sender;
          const receiver = userData?.receiver;
          const otherUser =
            sender?.authId === currentUserId || sender?.uid === currentUserId
              ? receiver
              : sender;

          const displayName = otherUser?.displayName || 'Unnamed User';
          const type = otherUser?.type || 'Previous Conversation';
          const photoURL = otherUser?.photoURL || '';
          const unreadCount = unreadCounts[docID] || 0;
          const isActive = activeConversation?.docID === docID;


          return (
            <div
              key={docID}
              className="chatroom-item"
              onClick={() => handleConversationClick(conversation)}
            >
              <div className="conversation">
                <div>
                  <h5>{displayName}</h5>
                  <p>{type}</p>
                  <p className='lastContacted'>
                    Last Contact: {userData?.receiver?.lastContacted?.seconds
                      ? new Date(createdAt.seconds * 1000).toLocaleString()
                      : ''}
                  </p>
                  {hasUnread && <UnreadBadge isConvo={true} />}


                  <div className='convo-starter'>
                    {/* <h6>Last message: "{lastMessage?.body || 'No messages yet.'}"</h6> */}
                  </div>
                </div>
                <div className="conversation-actions">
                  {isActive && ( 
                    <button
                      type="button"
                      className="close-conversation-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveConversation(null);
                      }}
                      aria-label="Close conversation"
                    >
                      Close conversation
                    </button>
                  )}
                </div>
                <div className='caret-container'>
                  <RxCaretRight />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </IconContext.Provider>
  );
}

export default ConversationsList;
