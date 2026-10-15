import React from 'react';
import './App.css';
import { useAuth } from './components/UserAuth/AuthContext';
import AppLayout from './AppLayout';
import UserAuth from './components/UserAuth/UserAuth';
import VerifyEmail from './components/UserAuth/VerifyEmail';
import Dashboard from './components/Dashboard/Dashboard';
import LoadingScreen from './LoadingScreen';

function App() {
  const { user, userData, authLoading } = useAuth();

  // Study default: verification gate is off (matches REQUIRE_EMAIL_VERIFICATION=false on Lambda).
  // Only show VerifyEmail when explicitly enabled in the frontend build.
  const requireEmailVerification =
    String(process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';
  const isVerified = user?.emailVerified !== false;

  if (authLoading) {
    return (
      <AppLayout>
        <LoadingScreen />
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <UserAuth />
      </AppLayout>
    );
  }

  if (requireEmailVerification && !isVerified) {
    return (
      <AppLayout>
        <VerifyEmail />
      </AppLayout>
    );
  }

  if (!userData) {
    return (
      <AppLayout>
        <LoadingScreen />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}

export default App;
