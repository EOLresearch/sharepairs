import { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as authService from '../../services/authService';
import SystemMessage from '../SystemMessage/SystemMessage';

const AuthContext = createContext();

const AUTH_POLL_MS = 5000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [systemMessage, setSystemMessage] = useState(null);
  const pollRef = useRef(null);

  const refreshAuth = async () => {
    try {
      const data = await authService.getCurrentUser();
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
      setUser(null);
      setUserData(null);
      setAuthLoading(false);
      return null;
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(refreshAuth, AUTH_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user]);

  const login = async (email, password) => {
    await authService.login(email, password);
    const data = await refreshAuth();
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
      await authService.register(email, password, userDetails, false);
      setSystemMessage({
        message: 'Verification email sent. Please check your inbox.',
        type: 'success',
      });
      await logout();
      return { success: true };
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
      await authService.resendVerificationEmail();
      setSystemMessage({ message: 'Verification email sent.', type: 'success' });
    } catch (err) {
      setSystemMessage({
        message: 'Resend failed: ' + (err?.message || String(err)),
        type: 'error',
      });
    }
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
        resetAuthContext,
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
