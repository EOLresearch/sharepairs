import { useState, useEffect } from 'react';
import { listenToConversations } from '../services/matchService';
import { respondToConsent } from '../services/consentService';

export default function useConversations(authId, userData, pendingConsentId, onConsentAccepted) {
  const [conversations, setConversations] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  useEffect(() => {
    if (!authId || !userData) return;
    const unsubscribe = listenToConversations((convos) => {
      setConversations(convos);

      if (pendingConsentId) {
        const activated = convos.find((c) => c.docID === pendingConsentId && c.mutualConsent);
        if (activated) onConsentAccepted(activated);
      }

      const consentBy = (c) => c.consentBy ?? c.consentGivenBy;
      setIncomingRequests(
        convos.filter(
          (c) => !c.mutualConsent && !(Array.isArray(consentBy(c)) && consentBy(c).includes(authId))
        )
      );
    });
    return unsubscribe;
  }, [authId, userData, pendingConsentId, onConsentAccepted]);

  const acceptRequest = (requestId) =>
    respondToConsent(requestId, true).catch(console.error);

  return { conversations, incomingRequests, acceptRequest };
}
