import { useState, useEffect } from 'react';
import { listenToUserConversations, acceptConversationRequest } from '../helpers/firebasehelpers-telemetry';

export default function useConversations(authId, userData, pendingConsentId, onConsentAccepted) {
  const [conversations, setConversations] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  useEffect(() => {
    if (!authId || !userData) return;
    const unsubscribe = listenToUserConversations(authId, convos => {
      setConversations(convos);

      if (pendingConsentId) {
        const activated = convos.find(c => c.docID === pendingConsentId && c.mutualConsent);
        if (activated) onConsentAccepted(activated);
      }

      setIncomingRequests(
        convos.filter(c => !c.mutualConsent && !c.consentBy?.includes(authId))
      );
    });
    return unsubscribe;
  }, [authId, userData, pendingConsentId, onConsentAccepted]);

  // Optional: encapsulate the accept flow here instead of in Chatroom
  const acceptRequest = (requestId) =>
    acceptConversationRequest(requestId, authId).catch(console.error);

  return { conversations, incomingRequests, acceptRequest };
}
