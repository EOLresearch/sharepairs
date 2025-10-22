import './welcomemessage.css';
import { useState } from 'react';
import simpaticoLogo from '../../assets/sharepairslogo.png';
import StudySupportMessage from './StudySupportMessage';
import LanguageToggle from '../LanguageToggle/LanguageToggle';
import { translate } from '../../helpers/translate';
import en from '../../translations/en';
import tr from '../../translations/tr';

function WelcomeMessage({ userData, setShowWelcomeMessage, language, setLanguage }) {
  const t = language === 'tr' ? tr : en;

  return (
    <div className="welcome-message">
      <div className='header'>
        <div className='image-container'>
          <img className='profile-image' alt={`Profile of user`} src={simpaticoLogo} />
        </div>
        <div className='header-text'>
          <p><strong>{translate(t.welcome.hello_user, { name: userData.displayName })}</strong></p>
          <p>{t.welcome.thank_you}</p>
{/* 
          <div className='language-toggle-container'>
            <LanguageToggle language={language} setLanguage={setLanguage} />
          </div> */}
          
        </div>
        <button className='welcome-close' onClick={e => setShowWelcomeMessage(false)}>X</button>

      </div>

      <div className='body'>
        <p>{t.welcome.intro_1}</p>
        <p>{t.welcome.intro_2}</p>
        <div className='side-instructions'>
          <p><b>{t.welcome.left_panel}</b></p>
          <p><b>{t.welcome.center_panel}</b></p>
          <p><b>{t.welcome.right_panel}</b></p>
        </div>
        <div className='match-details'>
          {/* {match
            ? <h4>You have been matched with {match.displayName}.</h4>
            : <p>You currently don't have a match. Hang tight!</p>
          } */}
        </div>
        <StudySupportMessage language={language} />
      </div>
    </div>
  );
}

export default WelcomeMessage;
