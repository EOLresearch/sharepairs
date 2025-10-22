import React from 'react';
import WelcomeMessage from '../WelcomeMessage';
import DistressThermometer from '../../DistressThermometer/DistressThermometer';
import DistressPopup from '../../DistressThermometer/DistressPopup';

export default function OverlayManager({
  showWelcomeMessage,
  setShowWelcomeMessage,
  showDistressPopup,
  setShowDistressPopup,
  showWarning,
  setShowWarning,
  showDistressThermometer,
  setShowDistressThermometer,
  handleDistressSelection,
  userData,
  language, 
  setLanguage,
  distressLevel
}) {
  const isAdmin = !!userData?.admin;

  return (
    <>
      {showDistressPopup && (
        <DistressPopup
          setShowDistressPopup={setShowDistressPopup}
          handleDistressSelection={handleDistressSelection}
          language={language}
          distressLevel={distressLevel}
        />
      )}

      {showWarning && (
        <div className="welcome-message-overlay">
          <div className="welcome-message">
            <h3>Inappropriate Language Detected</h3>
            <p>This warning appears when inappropriate content is detected. It will be refined before launch.</p>
            <button onClick={() => setShowWarning(false)}>Okay</button>
          </div>
        </div>
      )}

      {!isAdmin && showDistressThermometer && (
        <div className="welcome-message-overlay">
          <DistressThermometer
            setShowDistressThermometer={setShowDistressThermometer}
            handleDistressSelection={handleDistressSelection}
            language={language}
          />
        </div>
      )}

      {!isAdmin && showWelcomeMessage && (
        <div className="welcome-message-overlay">
          <WelcomeMessage
            userData={userData}
            setShowWelcomeMessage={setShowWelcomeMessage}
            language={language}
            setLanguage={setLanguage}
          />
        </div>
      )}
    </>
  );
}
