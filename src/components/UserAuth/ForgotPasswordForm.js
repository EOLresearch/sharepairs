import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import en from '../../translations/en';
import tr from '../../translations/tr';

const ForgotPasswordForm = ({ setError, handleToggleView, language }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const t = language === 'tr' ? tr : en;

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setStatus(t.forgot.status_sent);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError(t.forgot.error_not_found);
      } else {
        setError(t.forgot.error_generic);
        console.error("Reset error:", err.message);
      }
    }
    setLoading(false);
  };

  return (
    <form className="forgotPassForm" onSubmit={handleReset}>
      {status && <p className="status-message">{status}</p>}
      <p>{t.forgot.instructions}</p>
      <input
        type="email"
        placeholder={t.forgot.placeholder_email}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        name="email"
        required
      />
      <div className='btn-container'>
        <button type="submit" disabled={loading}>
          {loading ? t.forgot.sending : t.forgot.send_button}
        </button>
        <button type="button" onClick={() => handleToggleView('login')}>
          {t.forgot.back_to_login}
        </button>
      </div>
    </form>
  );
};

ForgotPasswordForm.propTypes = {
  setError: PropTypes.func.isRequired,
  handleToggleView: PropTypes.func.isRequired,
  language: PropTypes.string.isRequired
};

export default ForgotPasswordForm;
