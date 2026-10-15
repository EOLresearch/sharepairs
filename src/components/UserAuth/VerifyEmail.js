// components/UserAuth/VerifyEmail.js
import { useState } from 'react';
import { useAuth } from '../UserAuth/AuthContext';
import en from '../../translations/en';
import tr from '../../translations/tr';

export default function VerifyEmail({ language = 'en' }) {
  const { user, verifyEmail, resendVerificationEmail, logout } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = language === 'tr' ? tr : en;
  const v = t.verify;

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verifyEmail(code.trim());
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
      await resendVerificationEmail();
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
