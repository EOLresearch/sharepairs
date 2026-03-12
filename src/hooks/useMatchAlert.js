import { useState, useEffect } from 'react';
import { updateUserProfile } from '../services/authService';

export default function useMatchAlert(authId, userData, showWelcome) {
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    if (showWelcome || !userData) return;
    const matched = Boolean(userData.simpaticoMatch);
    if (matched && !hasShown && !userData.hasSeenMatch) {
      alert(
        '🎉 You have been matched! View the contacts panel to see your new match.'
      );
      setHasShown(true);
      updateUserProfile(authId, { hasSeenMatch: true }).catch(console.error);
    }
    if (!matched && hasShown) {
      setHasShown(false);
    }
  }, [authId, userData, showWelcome, hasShown]);
}
