import { useState, useEffect } from 'react';
import { db } from '../fb';
import {
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { acceptConversationRequest } from '../helpers/firebasehelpers-telemetry';

export default function useIncomingRequests(authId) {
  const [incomingRequests, setIncomingRequests] = useState([]);

  useEffect(() => {
    if (!authId) {
      setIncomingRequests([]);
      return;
    }

    const q = query(
      collection(db, 'conversations'),
      where('users', 'array-contains', authId),
      where('mutualConsent', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const pending = [];
        snapshot.forEach(doc => {
          const data = { ...doc.data(), docID: doc.id };

          // client-side filter: haven’t already consented
          if (
            !Array.isArray(data.consentGivenBy) ||
            !data.consentGivenBy.includes(authId)
          ) {
            pending.push(data);
          }
        });

        console.log('[useIncomingRequests] pending:', pending);
        setIncomingRequests(pending);
      },
      err => {
        console.error('[useIncomingRequests] snapshot error:', err);
      }
    );

    return unsubscribe;
  }, [authId]);

  const acceptRequest = async requestId => {
    try {
      console.log('[useIncomingRequests] accepting', requestId);
      await acceptConversationRequest(requestId, authId);
    } catch (err) {
      console.error('[useIncomingRequests] accept error:', err);
    }
  };

  return { incomingRequests, acceptRequest };
}
