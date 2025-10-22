import { useState, useEffect } from 'react';
import { listenToUserData } from '../helpers/firebasehelpers-telemetry';

export default function useUserData(authId) {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!authId) return;
    const unsubscribe = listenToUserData(authId, setUserData);
    return unsubscribe;
  }, [authId]);

  return userData;
}
