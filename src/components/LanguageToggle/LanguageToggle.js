import React from "react";
import "./LanguageToggle.css";

const LanguageToggle = ({ language, setLanguage }) => {
  return (
    <div className="language-toggle">
      <button
        className={`toggle-button ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
      <button
        className={`toggle-button ${language === 'tr' ? 'active' : ''}`}
        onClick={() => setLanguage('tr')}
      >
        TR
      </button>
    </div>
  );
};

export default LanguageToggle;
