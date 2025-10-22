import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import en from '../../translations/en';
import tr from '../../translations/tr';

const LoginForm = ({ setError, handleToggleView, language }) => {
  const { login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const t = language === 'tr' ? tr : en;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'email') setEmail(value);
    if (name === 'password') setPassword(value);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCred = await login(email, password);
      if (!userCred.user.emailVerified) {
        await logout();
        setError(t.auth.error_unverified);
        setLoading(false);
        return;
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError(t.auth.error_invalid_credentials);
      } else {
        setError(t.auth.error_generic);
      }
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <div className="fields-container">
      <form className="login" onSubmit={handleLogin}>
        <h1>{t.auth.login_title}</h1>

        <div className='input-container'>
          <i className="fas fa-envelope"></i>
          <input
            id="email"
            type="email"
            placeholder={t.auth.email_placeholder}
            value={email}
            onChange={handleChange}
            name="email"
            required
          />
        </div>

        <div className='input-container'>
          <i className="fas fa-lock"></i>
          <input
            id="password"
            type="password"
            placeholder={t.auth.password_placeholder}
            value={password}
            onChange={handleChange}
            name="password"
            required
          />
        </div>

        <div className='btn-container'>
          <button className='sub-btn' type="submit" disabled={loading}>
            {loading ? t.auth.logging_in : t.auth.login_button}
          </button>

          <button className='forgot-pass-btn' type="button" onClick={() => handleToggleView('forgot')}>
            {t.auth.forgot_password}
          </button>

          <button type="button" onClick={() => handleToggleView('register')}>
            {t.auth.join_prompt}<strong>{t.auth.join_now}</strong>
          </button>
        </div>
      </form>
    </div>
  );
};

LoginForm.propTypes = {
  setError: PropTypes.func.isRequired,
  handleToggleView: PropTypes.func.isRequired,
  language: PropTypes.string.isRequired
};

export default LoginForm;
