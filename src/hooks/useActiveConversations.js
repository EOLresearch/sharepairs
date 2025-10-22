import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../fb'


/**
 * Hook to listen for active (mutually-consented) conversations in real-time.
 * Calls onConsentAccepted exactly once per newly activated conversation.
 *
 * @param {string} authId - Current user's UID
 * @param {function} onConsentAccepted - Callback invoked with conversation data
 * @returns {{ conversations: Array }}
 */
export default function useActiveConversations(authId, onConsentAccepted) {
  const [conversations, setConversations] = useState([]);
  // Keep track of which convo IDs we've already notified
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!authId) {
      setConversations([]);
      return;
    }

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('users', 'array-contains', authId),
      where('mutualConsent', '==', true)
    );

    const unsubscribe = onSnapshot(
      conversationsQuery,
      snapshot => {
        const active = [];
        snapshot.forEach(doc => {
          const convo = { ...doc.data(), docID: doc.id };
          active.push(convo);

          // If this convo is newly activated, call the callback once
          if (!notifiedRef.current.has(convo.docID)) {
            notifiedRef.current.add(convo.docID);
            if (typeof onConsentAccepted === 'function') {
              onConsentAccepted(convo);
            }
          }
        });

        setConversations(active);
      },
      error => {
        console.error('❌ listenActiveConversations failed:', error);
      }
    );

    return () => unsubscribe();
  }, [authId, onConsentAccepted]);

  return { conversations };
}
