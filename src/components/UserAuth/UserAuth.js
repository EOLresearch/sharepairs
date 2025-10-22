import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import SystemMessage from '../SystemMessage/SystemMessage';
import LoginForm from './LoginForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import UserDetailsForm from './UserDetailsForm/UserDetailsForm';
import './userauth.css';

const UserAuth = ({ language, setLanguage }) => {
  const [view, setView] = useState('login');
  const [error, setError] = useState();
  const [info, setInfo] = useState('');

  const handleToggleView = (nextView) => {
    setView(nextView);
    setError('');
  };

  const handleCancelError = () => setError('');

  return (
    <div className="auth-wrapper">
      <div className="error-container">
        {error && <SystemMessage message={error} cancelMessage={() => setError('')} type="error" />}
        {info && <SystemMessage message={info} cancelMessage={() => setError('')} type="info" />}
      </div>

      <div className="auth-container">
        {view === 'login' && (
          <LoginForm
            setError={setError}
            handleToggleView={handleToggleView}
            language={language}
          />
        )}

        {view === 'forgot' && (
          <ForgotPasswordForm
            setError={setError}
            handleToggleView={handleToggleView}
            language={language}
          />
        )}

        {view === 'register' && (
          <UserDetailsForm handleToggle={handleToggleView} language={language}/>
        )}
      </div>
    </div>
  );
};

export default UserAuth;
