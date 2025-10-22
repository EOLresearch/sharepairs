import React from 'react';
import simpaticoLogo from '../../../assets/eardpairtransparentbg.png';
import StartConversationButton from './StartConversationButton';
import en from '../../../translations/en';
import tr from '../../../translations/tr';

const InfoPanel = ({
  contact,
  currentUser,
  activeConversation,
  setActiveConversation,
  setShowDistressThermometer,
  isMutuallyConsented,
  onRequestSent, 
  setSystemMessage,
  conversations,
  language
}) => {
  if (!contact) return null;

  const t = language === 'tr' ? tr : en;
  const isMatch = contact.type === 'match';

  return (
    <div className="infocard-container">
      <div className="header">
        <div className="img-container">
          <img className="profile-image" alt="User" src={contact.photoURL || simpaticoLogo} />
        </div>
        <div className="header-text">
          <h3>{contact.displayName}</h3>
          <p>{t.info_panel.lives_in}: {contact.residence || t.info_panel.unknown}</p>
        </div>
      </div>

      <div className="body">
        {isMatch ? (
          <>
            <p>{t.info_panel.story_title}</p>
            <p>{contact.lossExp || t.info_panel.no_story}</p>
          </>
        ) : (
          <>
            <p>{t.info_panel.non_match}</p>
          </>
        )}
        <StartConversationButton
          currentUser={currentUser}
          contact={contact}
          setActiveConversation={setActiveConversation}
          setShowDistressThermometer={setShowDistressThermometer}
          isMutuallyConsented={isMutuallyConsented}
          onRequestSent={onRequestSent}
          setSystemMessage={setSystemMessage}
          activeConversation={activeConversation}
          conversations={conversations}
          language={language}
        />
      </div>
    </div>
  );
};

export default InfoPanel;
