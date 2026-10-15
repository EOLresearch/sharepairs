import './welcomemessage.css';
import StudySupportMessage from './StudySupportMessage';
import { translate } from '../../helpers/translate';
import en from '../../translations/en';

const sharePairsLogo = `${process.env.PUBLIC_URL}/sharepairslogo.png`;

function WelcomeMessage({ userData, setShowWelcomeMessage }) {
  const t = en;

  return (
    <div className="welcome-message">
      <div className='header'>
        <div className='image-container'>
          <img className='profile-image' alt="Share Pairs logo" src={sharePairsLogo} />
        </div>
        <div className='header-text'>
          <p><strong>{translate(t.welcome.hello_user, { name: userData.displayName })}</strong></p>
          <p>{t.welcome.thank_you}</p>
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
        </div>
        <StudySupportMessage />
      </div>
    </div>
  );
}

export default WelcomeMessage;
