import React from 'react';
import { RxCaretRight } from 'react-icons/rx';
import { IconContext } from 'react-icons';
import UnreadBadge from '../UnreadBadge/UnreadBadge';
import { getSupportUid } from '../../../constants';
import BlurredText from '../ChatMessage/BlurredText';

const supportImg = `${process.env.PUBLIC_URL}/sharepairslogo.png`;

function convoImage(other) {
  if (other?.type === 'support') return supportImg;
  return other?.photoURL || supportImg;
}

function convoUnreadFor(conversation, currentUserId) {
  const list = conversation?.hasUnreadBy;
  return Array.isArray(list) && !!currentUserId && list.includes(currentUserId);
}

function matchUidOf(match) {
  if (!match) return null;
  if (typeof match === 'string') return match;
  return match.uid || match.authId || null;
}

function otherParticipant(conversation, currentUserId, contacts = [], simpaticoMatch = null) {
  const users = Array.isArray(conversation?.users) ? conversation.users : [];
  const otherUid =
    conversation?.otherUserUid ||
    users.find((uid) => uid !== currentUserId) ||
    null;
  if (!otherUid) return { displayName: 'Conversation', type: '', uid: null };

  if (otherUid === getSupportUid()) {
    return {
      uid: otherUid,
      displayName: 'Study Support',
      type: 'support',
      photoURL: '',
    };
  }

  const contact = (contacts || []).find((c) => c?.uid === otherUid);
  const matchUid = matchUidOf(simpaticoMatch);
  const matchName =
    matchUid === otherUid && typeof simpaticoMatch === 'object'
      ? simpaticoMatch.displayName || simpaticoMatch.display_name || simpaticoMatch.email
      : '';
  const name =
    contact?.displayName ||
    contact?.display_name ||
    contact?.email ||
    conversation?.otherDisplayName ||
    matchName ||
    '';

  return {
    uid: otherUid,
    displayName: name || 'Participant',
    type: contact?.type || (matchUid === otherUid ? 'match' : '') || '',
    photoURL:
      contact?.photoURL ||
      contact?.photo_url ||
      (matchUid === otherUid && typeof simpaticoMatch === 'object' &&
        (simpaticoMatch.photoURL || simpaticoMatch.photo_url)) ||
      '',
  };
}

function ConversationsList({
  conversations,
  currentUserId,
  handleConversationClick,
  setActiveConversation,
  activeConversation,
  showUnreadBadges = true,
  contacts = [],
  simpaticoMatch = null,
}) {
  return (
    <IconContext.Provider value={{ className: 'react-icons-contacts' }}>
      <div className="conversations-list">
        {(conversations || []).map((conversation) => {
          const { docID } = conversation;
          const other = otherParticipant(
            conversation,
            currentUserId,
            contacts,
            simpaticoMatch
          );
          const isUnread = showUnreadBadges && convoUnreadFor(conversation, currentUserId);
          const isActive = activeConversation?.docID === docID;
          const lastAt = conversation.lastMsgAt;
          const lastLabel =
            typeof lastAt === 'number'
              ? new Date(lastAt > 1e12 ? lastAt : lastAt * 1000).toLocaleString()
              : lastAt?.seconds
                ? new Date(lastAt.seconds * 1000).toLocaleString()
                : '';

          return (
            <div
              key={docID}
              className={`chatroom-item${isActive ? ' is-active' : ''}`}
              onClick={() => handleConversationClick(conversation)}
            >
              <div className="conversation">
                <div className="img-container convo-avatar">
                  <img
                    className="profile-image"
                    alt=""
                    src={convoImage(other)}
                  />
                </div>
                <div className="conversation-body">
                  <h5>{other.displayName}</h5>
                  {other.type && other.type !== 'match' ? <p>{other.type}</p> : null}
                  {conversation.moderationStatus === 'paused' ? (
                    <p className="conversation-moderation-note">Paused</p>
                  ) : null}
                  {conversation.moderationStatus === 'terminated' ? (
                    <p className="conversation-moderation-note">Ended</p>
                  ) : null}
                  {lastLabel ? (
                    <p className="lastContacted">Last message: {lastLabel}</p>
                  ) : null}
                  {conversation.lastMsgPreview ? (
                    <div className="convo-starter">
                      <h6>
                        <BlurredText text={conversation.lastMsgPreview} />
                      </h6>
                    </div>
                  ) : null}
                  {isUnread ? <UnreadBadge isConvo={true} /> : null}
                </div>
                <div className="caret-container">
                  <RxCaretRight />
                </div>
              </div>
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
          );
        })}
      </div>
    </IconContext.Provider>
  );
}

export default ConversationsList;
