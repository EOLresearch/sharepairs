import { useState, useEffect, useRef, useCallback } from 'react';
import { getConversations } from '../services/matchService';
import { on, off } from '../realtime';

/**
 * Subscribe to active (mutually-consented) conversations via WebSocket.
 */
export default function useActiveConversations(authId, onConsentAccepted) {
  const [conversations, setConversations] = useState([]);
  const notifiedRef = useRef(new Set());

  const refresh = useCallback(async () => {
    if (!authId) {
      setConversations([]);
      return;
    }
    try {
      const list = await getConversations();
      const active = Array.isArray(list) ? list.filter((c) => c.mutualConsent) : [];
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
      console.error('useActiveConversations refresh failed:', err);
    }
  }, [authId, onConsentAccepted]);

  useEffect(() => {
    if (!authId) {
      setConversations([]);
      return undefined;
    }
    refresh();
    on('conversationUpdate', refresh);
    return () => off('conversationUpdate', refresh);
  }, [authId, refresh]);

  return { conversations };
}
