import { useState, useEffect, useRef } from 'react';
import { getConversations } from '../services/matchService';

const POLL_MS = 5000;

/**
 * Hook to poll for active (mutually-consented) conversations.
 * Calls onConsentAccepted exactly once per newly activated conversation.
 */
export default function useActiveConversations(authId, onConsentAccepted) {
  const [conversations, setConversations] = useState([]);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!authId) {
      setConversations([]);
      return;
    }

    const poll = async () => {
      try {
        const list = await getConversations();
        const active = Array.isArray(list)
          ? list.filter((c) => c.mutualConsent)
          : [];
        setConversations(active);

        active.forEach((convo) => {
          const id = convo.docID || convo.cid || convo.id;
          if (id && !notifiedRef.current.has(id)) {
            notifiedRef.current.add(id);
            if (typeof onConsentAccepted === 'function') {
              onConsentAccepted({ ...convo, docID: id });
            }
          }
        });
      } catch (err) {
        console.error('useActiveConversations poll failed:', err);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [authId, onConsentAccepted]);

  return { conversations };
}
