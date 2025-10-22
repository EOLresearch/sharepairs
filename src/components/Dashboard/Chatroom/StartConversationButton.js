import React from 'react';
import { createConversation } from '../../../helpers/firebasehelpers';
import en from '../../../translations/en';
import tr from '../../../translations/tr';

export default function StartConversationButton({
  currentUser,
  contact,
  conversations = [],
  activeConversation,
  setActiveConversation,
  setShowDistressThermometer,
  setSystemMessage,
  language
}) {
  const t = language === 'tr' ? tr : en;
  const myUid = currentUser?.authId || currentUser?.uid;
  const otherUid = contact?.uid;

  // existing conversation with this contact?
  const existing = conversations.find(c => Array.isArray(c.users) && c.users.includes(otherUid));
  const isActive = !!(activeConversation?.users && activeConversation.users.includes(otherUid));

  const handleClick = async () => {
    if (!myUid || !otherUid) return;

    if (existing) {
      if (existing.mutualConsent && !isActive) {
        setSystemMessage({
          message: t.convo_btn.open_prompt.replace('{name}', contact.displayName),
          type: 'info',
          action: () => {
            setActiveConversation({ ...existing, otherUserUid: otherUid });
            setSystemMessage(null);
          },
          cancelMessage: () => setSystemMessage(null),
        });
      }
      return;
    }

    try {
      const result = await createConversation(myUid, otherUid);
      // Support both shapes:
      // - old: { conversation: {...} }
      // - new: { docID, users, ... }
      const convo = result?.conversation || result;

      if (!convo) throw new Error('No conversation returned');

      if (!convo.mutualConsent) {
        setSystemMessage({
          message: t.convo_btn.request_sent.replace('{name}', contact.displayName),
          type: 'success',
          cancelMessage: () => setSystemMessage(null),
        });
        return;
      }

      setActiveConversation({ ...convo, otherUserUid: otherUid });
      setShowDistressThermometer?.(true);
    } catch (err) {
      console.error('❌ Failed to create or fetch conversation:', err?.message || err);
      setSystemMessage({
        message: t.convo_btn.error.replace('{name}', contact.displayName),
        type: 'alert',
        cancelMessage: () => setSystemMessage(null),
      });
    }
  };

  // Button label/state
  let label = t.convo_btn.request;
  let disabled = false;

  if (existing) {
    if (!existing.mutualConsent) {
      label = t.convo_btn.pending;
      disabled = true;
    } else if (isActive) {
      label = t.convo_btn.open;
      disabled = true;
    } else {
      label = t.convo_btn.reopen;
    }
  }

  return (
    <button className="start-convo-btn" onClick={handleClick} disabled={disabled}>
      {label}
    </button>
  );
}
