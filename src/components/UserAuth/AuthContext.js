import { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as authService from '../../services/authService';
import { setTokenGetter } from '../../api/client';
import { on, off } from '../../realtime/client';
import SystemMessage from '../SystemMessage/SystemMessage';

const AuthContext = createContext();

const AUTH_POLL_MS = 5000;

function applyLiveMatch(current, payload) {
  if (!current || current.isSupport) return current;
  const id = current.authId || current.uid;
  const partner = payload?.matches?.[id];
  if (!partner?.uid) return current;
  const contacts = Array.isArray(current.contacts) ? current.contacts : [];
  return {
    ...current,
    simpaticoMatch: {
      uid: partner.uid,
      displayName: partner.displayName || '',
      photoURL: partner.photoURL || '',
    },
    contacts: [
      ...contacts.filter((c) => c?.type !== 'match' && c?.uid !== partner.uid),
      {
        uid: partner.uid,
        displayName: partner.displayName || '',
        photoURL: partner.photoURL || '',
        type: 'match',
      },
    ],
    matchNoticeSeen: false,
    hasSeenMatch: false,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [systemMessage, setSystemMessage] = useState(null);
  const pollRef = useRef(null);
  const refreshGen = useRef(0);
  const refreshAuthRef = useRef(async () => null);

  useEffect(() => {
    setTokenGetter(() => authService.getStoredToken());
  }, []);

  const refreshAuth = async () => {
    const gen = ++refreshGen.current;
    try {
      const data = await authService.getCurrentUser();
      if (gen !== refreshGen.current) return null;
      if (data?.user) {
        const ud = data.userData ?? { authId: data.user.uid, ...data.user };
        setUser(data.user);
        setUserData(ud);
        setAuthLoading(false);
        return { user: data.user, userData: ud };
      } else {
        setUser(null);
        setUserData(null);
        setAuthLoading(false);
        return null;
      }
    } catch {
      if (gen !== refreshGen.current) return null;
      setUser(null);
      setUserData(null);
      setAuthLoading(false);
      return null;
    }
  };
  refreshAuthRef.current = refreshAuth;

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    const handler = (payload) => {
      refreshGen.current += 1;
      setUserData((current) => applyLiveMatch(current, payload));
    };
    on('matchCreated', handler);
    return () => off('matchCreated', handler);
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    pollRef.current = setInterval(() => {
      refreshAuthRef.current();
    }, AUTH_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user?.uid]);

  const login = async (email, password) => {
    const result = await authService.login(email, password);
    // Prefer the login payload so a flaky /me cannot leave the UI stuck on Login
    if (result?.user) {
      const ud = result.userData ?? { authId: result.user.uid, ...result.user };
      setUser(result.user);
      setUserData(ud);
      setAuthLoading(false);
      // Refresh in background to stay in sync with the server
      refreshAuth().catch(() => {});
      return { user: result.user, userData: ud };
    }
    const data = await refreshAuth();
    if (!data?.user) {
      const err = new Error('Login succeeded but session could not be established');
      err.code = 'auth/session';
      throw err;
    }
    return data;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setUserData(null);
    }
  };

  const resetPassword = (email) => authService.resetPassword(email);

  const registerAndStoreUser = async (email, password, userDetails) => {
    try {
      const result = await authService.register(email, password, userDetails, false);
      const needsConfirmation = result?.needsConfirmation === true;

      if (result?.token) {
        authService.setStoredToken(result.token);
      }
      authService.resetWelcomeSeen();

      if (needsConfirmation) {
        await refreshAuth();
        if (result.devCode) {
          try {
            sessionStorage.setItem('pendingVerifyCode', result.devCode);
          } catch { /* ignore */ }
        }
        const mailNote = result.devCode
          ? `Email delivery is not working yet — your code is ${result.devCode}`
          : 'Verification email sent. Enter the 6-digit code to continue.';
        setSystemMessage({
          message: mailNote,
          type: result.devCode ? 'info' : 'success',
        });
        return { success: true, needsConfirmation: true, devCode: result.devCode || null };
      }

      // Auto-verified (study mode) — stay signed in and enter the app
      await refreshAuth();
      setSystemMessage({
        message: 'Account created. Welcome!',
        type: 'success',
      });
      return { success: true, needsConfirmation: false };
    } catch (err) {
      setSystemMessage({
        message: 'Registration error: ' + (err?.message || String(err)),
        type: 'error',
      });
      throw err;
    }
  };

  const resendVerificationEmail = async () => {
    try {
      const result = await authService.resendVerificationEmail();
      if (result?.devCode) {
        try {
          sessionStorage.setItem('pendingVerifyCode', result.devCode);
        } catch { /* ignore */ }
        setSystemMessage({
          message: `Email not delivered — your code is ${result.devCode}`,
          type: 'info',
        });
        return result;
      }
      setSystemMessage({ message: 'Verification email sent.', type: 'success' });
      return result;
    } catch (err) {
      setSystemMessage({
        message: 'Resend failed: ' + (err?.message || String(err)),
        type: 'error',
      });
      throw err;
    }
  };

  const verifyEmail = async (code) => {
    await authService.verifyEmail(code);
    setSystemMessage({ message: 'Email verified. Welcome!', type: 'success' });
    await refreshAuth();
  };

  const resetAuthContext = () => {
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        authLoading,
        login,
        logout,
        resetPassword,
        registerAndStoreUser,
        resendVerificationEmail,
        verifyEmail,
        resetAuthContext,
        refreshAuth,
      }}
    >
      {children}
      {systemMessage && (
        <SystemMessage
          message={systemMessage.message}
          type={systemMessage.type}
          cancelMessage={() => setSystemMessage(null)}
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
