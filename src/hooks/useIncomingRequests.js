import { useState, useEffect, useCallback } from 'react';
import { getConversations } from '../services/matchService';
import { respondToConsent } from '../services/consentService';
import { on, off } from '../realtime';

function filterIncoming(list, authId) {
  const consentBy = (c) => c.consentBy ?? c.consentGivenBy;
  return (Array.isArray(list) ? list : []).filter(
    (c) =>
      !c.mutualConsent &&
      (!Array.isArray(consentBy(c)) || !consentBy(c).includes(authId))
  );
}

export default function useIncomingRequests(authId) {
  const [incomingRequests, setIncomingRequests] = useState([]);

  const refresh = useCallback(async () => {
    if (!authId) {
      setIncomingRequests([]);
      return;
    }
    try {
      const list = await getConversations();
      const pending = filterIncoming(list, authId);
      setIncomingRequests(pending.map((c) => ({ ...c, docID: c.docID || c.cid || c.id })));
    } catch (err) {
      console.error('[useIncomingRequests] refresh error:', err);
    }
  }, [authId]);

  useEffect(() => {
    if (!authId) {
      setIncomingRequests([]);
      return undefined;
    }
    refresh();
    on('conversationUpdate', refresh);
    return () => off('conversationUpdate', refresh);
  }, [authId, refresh]);

  const acceptRequest = async (requestId) => {
    try {
      await respondToConsent(requestId, true);
    } catch (err) {
      console.error('[useIncomingRequests] accept error:', err);
    }
  };

  return { incomingRequests, acceptRequest };
}
