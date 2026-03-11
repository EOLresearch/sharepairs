import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';

const USER_DATA_POLL_MS = 5000;

export default function useUserData(authId) {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!authId) return;

    const fetchUser = async () => {
      try {
        const data = await getCurrentUser();
        if (data?.user && data.user.uid === authId) {
          setUserData(data.userData ?? { authId: data.user.uid, ...data.user });
        } else {
          setUserData(null);
        }
      } catch {
        setUserData(null);
      }
    };

    fetchUser();
    const interval = setInterval(fetchUser, USER_DATA_POLL_MS);
    return () => clearInterval(interval);
  }, [authId]);

  return userData;
}
