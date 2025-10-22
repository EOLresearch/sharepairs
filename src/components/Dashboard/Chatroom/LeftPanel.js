import React from 'react';
import { RxCaretLeft, RxCaretRight } from "react-icons/rx";
import StudySupportMessage from '../StudySupportMessage';
import ContactsList from './ContactsList';
import ConversationsList from './ConversationsList';
import UnreadBadge from '../UnreadBadge/UnreadBadge';
import en from '../../../translations/en';
import tr from '../../../translations/tr';

export default function LeftPanel({
  expanded,
  setExpanded,
  activeList,
  setActiveList,
  userData,
  activeContact,
  activeConversation,
  setActiveConversation,
  setActiveContact,
  setShowDistressThermometer,
  onContactClick,
  handleConversationClick,
  activeConvo,
  conversations,
  onRequestSent,
  setSystemMessage,
  language,
  hasUnread
}) {
  const t = language === 'tr' ? tr : en;
  const currentUserId = userData?.authId || userData?.uid;
  const isChatDisabled = userData?.chatDisabled === true;
  const togglePanel = () => setExpanded(!expanded);


  const renderList = () => {
    if (activeList === 'contacts') {
      return (
        <ContactsList
          contacts={userData.contacts || []}
          userData={userData}
          activeContact={activeContact}
          activeConversation={activeConversation}
          setActiveConversation={setActiveConversation}
          setShowDistressThermometer={setShowDistressThermometer}
          onContactClick={onContactClick}
          setActiveList={setActiveList}
          setActiveContact={setActiveContact}
          conversations={activeConvo}
          onRequestSent={onRequestSent}
          setSystemMessage={setSystemMessage}
          hasUnread={hasUnread}
        />
      );
    }

    if (activeList === 'conversations') {
      return (
        <ConversationsList
          conversations={conversations}
          currentUserId={currentUserId}
          handleConversationClick={handleConversationClick}
          setSystemMessage={setSystemMessage}
          hasUnread={hasUnread}
          setActiveConversation={setActiveConversation}
          activeConversation={activeConversation}
        />
      );
    }

    return null;
  };

  return (
    <div className={`left-panel ${expanded ? 'expanded' : ''}`}>
      {!expanded && (
        <button className="toggle-btn" onClick={togglePanel}>
          <RxCaretRight />
        </button>
      )}

      {expanded && (
        <div className="panel-content">
          <div className="slider-btns left-side">
            <button
              className={activeList === 'contacts' ? 'activated-left' : ''}
              onClick={() => setActiveList('contacts')}
            >
              {t.left_panel.contacts}
            </button>
            <button
              className={activeList === 'conversations' ? 'activated-left' : ''}
              onClick={() => setActiveList('conversations')}
            >
              <div className="wrapper-for-unread">
                {t.left_panel.conversations}{hasUnread && <UnreadBadge />}
              </div>
            </button>
            <button className="toggle-btn" onClick={togglePanel}>
              <RxCaretLeft />
            </button>
          </div>

          {renderList()}

          <div className="support-message-container">
            <StudySupportMessage language={language} />
          </div>
        </div>
      )}
    </div>
  );
}
