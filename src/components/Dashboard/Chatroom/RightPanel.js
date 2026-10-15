import React from 'react';
import { RxCaretLeft, RxCaretRight } from "react-icons/rx";
import PromptsList from './PromptsList';
import InfoPanel from './InfoPanel';
import en from '../../../translations/en';

export default function RightPanel({
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
  handleConversationClick,
  onContactClick,
  activeConvo,
  conversations,
  setSystemMessage,
  hasUnread,
  onInsertStarter,
  isMatched = false,
  showGettingStarted = false,
  onDismissGettingStarted,
}) {
  const t = en;

  const renderList = () => {
    if (activeList === 'prompts') {
      return (
        <PromptsList
          activeConversation={activeConversation}
          onInsertStarter={onInsertStarter}
          isMatched={isMatched}
          showGettingStarted={showGettingStarted}
          onDismissGettingStarted={onDismissGettingStarted}
        />
      );
    }

    if (activeList === 'match') {
      return (
        <InfoPanel
          contact={activeContact}
          currentUser={userData}
          activeConversation={activeConversation}
          setActiveConversation={setActiveConversation}
          setShowDistressThermometer={setShowDistressThermometer}
          isMutuallyConsented={activeConversation?.mutualConsent}
          setSystemMessage={setSystemMessage}
          conversations={conversations}
        />
      );
    }

    return null;
  };
  const togglePanel = () => setExpanded(!expanded);
  return (
    <div className={`right-panel ${expanded ? 'expanded' : ''}`}>
      {!expanded && (
        <button className="toggle-btn" onClick={togglePanel}>
          <RxCaretLeft />
        </button>
      )}
      {expanded && (

        <div className='panel-content'>
          <div className="slider-btns right-side">
            <button className="toggle-btn" onClick={togglePanel}>
              <RxCaretRight />
            </button>
            <button
              className={activeList === 'match' ? 'activated-right' : ''}
              onClick={() => setActiveList('match')}
            >
              {t.right_panel.info}
            </button>
            <button
              className={activeList === 'prompts' ? 'activated-right' : ''}
              onClick={() => setActiveList('prompts')}
            >
              {t.right_panel.prompts}
            </button>
          </div>
          {renderList()}
        </div>

      )}
    </div>
  );
}
