// components/UserAuth/VerifyEmail.js
import { useEffect, useState } from 'react';
import { useAuth } from '../UserAuth/AuthContext';
import en from '../../translations/en';
import './verifyemail.css';

export default function VerifyEmail() {
  const { user, verifyEmail, resendVerificationEmail, logout } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  const t = en;
  const v = t.verify;

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pendingVerifyCode');
      if (stored) setDevCode(stored);
    } catch { /* ignore */ }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verifyEmail(code.trim());
      try {
        sessionStorage.removeItem('pendingVerifyCode');
      } catch { /* ignore */ }
    } catch (err) {
      setError(err?.message || v.error_generic);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setBusy(true);
    try {
      const result = await resendVerificationEmail();
      if (result?.devCode) {
        setDevCode(result.devCode);
        setCode(result.devCode);
      }
    } catch (err) {
      setError(err?.message || v.error_resend);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="verify-email">
      <h2>{v.title}</h2>
      <p>
        {v.sent_prefix} <strong>{user?.email}</strong>.
      </p>
      <p>{v.instructions}</p>
      {devCode ? (
        <div className="verify-email-devcode" role="status">
          Email delivery is not reaching your inbox yet. Use this code:&nbsp;
          <strong>{devCode}</strong>
        </div>
      ) : null}
      <form onSubmit={handleVerify} className="verify-email-form">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder={v.code_placeholder}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-label={v.code_placeholder}
          required
        />
        {error && <p className="verify-email-error">{error}</p>}
        <div className="verify-email-actions">
          <button type="submit" disabled={busy || code.length !== 6}>
            {busy ? v.verifying : v.verify_button}
          </button>
          <button type="button" onClick={handleResend} disabled={busy}>
            {v.resend_button}
          </button>
          <button type="button" onClick={logout} disabled={busy}>
            {v.sign_out}
          </button>
        </div>
      </form>
    </div>
  );
}
