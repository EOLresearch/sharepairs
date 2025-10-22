import React from 'react';
import { RxCaretLeft, RxCaretRight } from "react-icons/rx";
import PromptsList from './PromptsList';
import InfoPanel from './InfoPanel';
import en from '../../../translations/en';
import tr from '../../../translations/tr';

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
  language,
  hasUnread
}) {
  const t = language === 'tr' ? tr : en;

  const renderList = () => {
    if (activeList === 'prompts') {
      return <PromptsList prompts={userData.prompts || []} />;
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
          language={language}
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
