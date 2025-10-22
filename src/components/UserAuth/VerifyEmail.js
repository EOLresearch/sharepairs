// components/UserAuth/VerifyEmail.js
import { useAuth } from '../UserAuth/AuthContext';

export default function VerifyEmail() {
  const { user, resendVerificationEmail, logout } = useAuth();

  return (
    <div className="verify-email">
      <h2>Verify your email</h2>
      <p>We sent a verification link to <strong>{user?.email}</strong>.</p>
      <p>After verifying, return here and log in.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={resendVerificationEmail}>Resend verification</button>
        <button onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}
