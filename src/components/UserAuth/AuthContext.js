import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  sendEmailVerification,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';

import { auth } from '../../fb'; // <-- make sure you export `auth` from fb.js
import { ADMIN_EMAILS } from '../../admins';
import SystemMessage from '../SystemMessage/SystemMessage';

// helpers (new)
import {
  watchUserData,
  createUserDoc,
  ensureSupportContactFor,
} from '../../helpers/firebasehelpers';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);        // Firebase Auth user
  const [userData, setUserData] = useState(null); // Firestore profile (live)
  const [authLoading, setAuthLoading] = useState(true);
  const [systemMessage, setSystemMessage] = useState(null);

  const profileUnsubRef = useRef(null);
  const lastUidRef = useRef(null);

  // ---------- Auth state listener ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);

      // tear down old profile subscription
      profileUnsubRef.current?.();
      profileUnsubRef.current = null;

      if (fbUser) {
        lastUidRef.current = fbUser.uid;

        // (optional) reduce race-y 403s right after sign-in
        try { await fbUser.getIdToken(true); } catch {}

        // live subscribe to the user doc
        profileUnsubRef.current = watchUserData(fbUser.uid, (docData) => {
          setUserData(docData);
          setAuthLoading(false);
        });
      } else {
        lastUidRef.current = null;
        setUserData(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsub();
      profileUnsubRef.current?.();
    };
  }, []);

  // ---------- Auth actions ----------
  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => fbSignOut(auth);

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  /**
   * Register, create the user doc, add Support contact, send verification, sign out.
   * Leaves a success/failure SystemMessage.
   */
  const registerAndStoreUser = async (email, password, userDetails) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = cred.user;

      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
      await createUserDoc(
        fbUser.uid,
        fbUser.email,
        {
          ...userDetails,
          // keep server timestamp if you want on first write:
          createdAt: serverTimestamp(),
        },
        isAdmin
      );

      // best-effort support contact
      await ensureSupportContactFor(fbUser.uid);

      // verification
      try {
        await sendEmailVerification(fbUser);
        setSystemMessage({
          message: 'Verification email sent. Please check your inbox.',
          type: 'success',
        });
      } catch (err) {
        setSystemMessage({
          message:
            'Registration succeeded, but sending the verification email failed.',
          type: 'error',
        });
        // Optional: still proceed; user can click "Resend verification" later
      }

      // sign out so they must verify before using the app
      await fbSignOut(auth);

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
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.emailVerified) return;

    try {
      await sendEmailVerification(currentUser);
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
