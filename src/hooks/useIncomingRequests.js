import { useState, useEffect } from 'react';
import { getConversations } from '../services/matchService';
import { respondToConsent } from '../services/consentService';

const POLL_MS = 5000;

export default function useIncomingRequests(authId) {
  const [incomingRequests, setIncomingRequests] = useState([]);

  useEffect(() => {
    if (!authId) {
      setIncomingRequests([]);
      return;
    }

    const poll = async () => {
      try {
        const list = await getConversations();
        const consentBy = (c) => c.consentBy ?? c.consentGivenBy;
        const pending = (Array.isArray(list) ? list : []).filter(
          (c) =>
            !c.mutualConsent &&
            (!Array.isArray(consentBy(c)) || !consentBy(c).includes(authId))
        );
        setIncomingRequests(pending.map((c) => ({ ...c, docID: c.docID || c.cid || c.id })));
      } catch (err) {
        console.error('[useIncomingRequests] poll error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [authId]);

  const acceptRequest = async (requestId) => {
    try {
      await respondToConsent(requestId, true);
    } catch (err) {
      console.error('[useIncomingRequests] accept error:', err);
    }
  };

  return { incomingRequests, acceptRequest };
}
