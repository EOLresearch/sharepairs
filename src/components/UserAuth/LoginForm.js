import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FaEnvelope, FaLock } from 'react-icons/fa';
import { useAuth } from './AuthContext';
import { isLocalApp } from '../../helpers/localEnv';
import en from '../../translations/en';

const LoginForm = ({ setError, handleToggleView }) => {
  const { login } = useAuth();
  const local = isLocalApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const t = en;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'email') setEmail(value);
    if (name === 'password') setPassword(value);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        msg.includes('invalid credentials') ||
        msg.includes('invalid email or password')
      ) {
        setError(t.auth.error_invalid_credentials);
      } else {
        setError(err?.message || t.auth.error_generic);
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
          <FaEnvelope aria-hidden="true" />
          <input
            id="email"
            type="text"
            autoComplete="username"
            placeholder={t.auth.email_placeholder}
            value={email}
            onChange={handleChange}
            name="email"
            required
          />
        </div>

        <div className='input-container'>
          <FaLock aria-hidden="true" />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
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

          {!local && <p className="login-hint">{t.auth.study_login_hint}</p>}

          {local && (
            <button type="button" onClick={() => handleToggleView('register')}>
              {t.auth.join_prompt}<strong>{t.auth.join_now}</strong>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

LoginForm.propTypes = {
  setError: PropTypes.func.isRequired,
  handleToggleView: PropTypes.func.isRequired,
};

export default LoginForm;
