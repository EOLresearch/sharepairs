import React, { useState } from 'react';
import './App.css';
import { useAuth } from './components/UserAuth/AuthContext';
import AppLayout from './AppLayout';
import UserAuth from './components/UserAuth/UserAuth';
import VerifyEmail from './components/UserAuth/VerifyEmail';
import Dashboard from './components/Dashboard/Dashboard';
import LoadingScreen from './LoadingScreen';

function App() {
  const { user, userData, authLoading } = useAuth();
  const [language, setLanguage] = useState('en');

  const isVerified = user?.emailVerified ?? false;

  if (authLoading) {
    return (
      <AppLayout language={language} setLanguage={setLanguage}>
        <LoadingScreen />
      </AppLayout>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <AppLayout language={language} setLanguage={setLanguage}>
        <UserAuth language={language} setLanguage={setLanguage} />
      </AppLayout>
    );
  }

  // Signed in but not verified
  if (!isVerified) {
    return (
      <AppLayout language={language} setLanguage={setLanguage}>
        <VerifyEmail />
      </AppLayout>
    );
  }

  // Verified but profile still loading
  if (!userData) {
    return (
      <AppLayout language={language} setLanguage={setLanguage}>
        <LoadingScreen />
      </AppLayout>
    );
  }

  // Verified and profile loaded
  return (
    <AppLayout language={language} setLanguage={setLanguage}>
      <Dashboard language={language} setLanguage={setLanguage} />
    </AppLayout>
  );
}

export default App;
