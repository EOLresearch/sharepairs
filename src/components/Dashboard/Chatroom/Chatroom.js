import React, { useMemo, useState, useEffect, useCallback } from 'react';
import './chatroom.css';
import { IconContext } from 'react-icons';
import OverlayManager from './OverlayManager';
import LeftPanel from './LeftPanel';
import MessageWindow from './MessageWindow';
import RightPanel from './RightPanel';
import SystemMessage from '../../SystemMessage/SystemMessage';
import { useAuth } from '../../UserAuth/AuthContext';
import {
  listenToUserConversations,
  acceptConversation,
  updateUserProfile,
  markConversationSeen,
  addContactIfNotExists,
  sendDistressAlertEmail,
  logDistressSelection,
  disableChatForUser,
  SUPPORT_UID
} from '../../../helpers/firebasehelpers';
import { logEffectLifecycle } from '../../../helpers/telemetry';
import en from '../../../translations/en';
import tr from '../../../translations/tr';

const SCREEN = 'Chatroom';

// Dev-only lifecycle logger (no-op in prod)
const effectLogger =
  (process.env.NODE_ENV !== 'production')
    ? logEffectLifecycle
    : () => () => {};

export default function Chatroom({ language, setLanguage }) {
  const t = useMemo(() => (language === 'tr' ? tr : en), [language]);
  const iconCtx = useMemo(() => ({ className: 'react-icons-chatroom' }), []);

  // Single source of truth: pull both auth user and profile from AuthContext
  const { user, userData } = useAuth();
  const authId = user?.uid;

  // UI state
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const [showDistressThermometer, setShowDistressThermometer] = useState(false);
  const [showDistressPopup, setShowDistressPopup] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [activeLeftList, setActiveLeftList] = useState('conversations');
  const [activeRightList, setActiveRightList] = useState('match');
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);

  // Chat state
  const [activeContact, setActiveContact] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);

  // Global message
  const [systemMessage, setSystemMessage] = useState(null);
  const clearSystemMessage = useCallback(() => setSystemMessage(null), []);

  // Guards
  const [acceptingConvoId, setAcceptingConvoId] = useState(null);
  const [distressSubmitting, setDistressSubmitting] = useState(false);

  // Ensure Study Support contact exists (client-side best-effort; safe to no-op if rules block)
  useEffect(() => {
    if (!authId || !userData) return;
    const cleanup = effectLogger(SCREEN, 'EnsureSupportContact', { uid: authId });

    const supportUid = 'ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1';
    if (authId === supportUid) return cleanup();

    const hasContacts = Array.isArray(userData.contacts);
    const alreadyHasSupport = hasContacts
      ? userData.contacts.some(c => c.uid === supportUid && c.type === 'support')
      : false;

    if (!alreadyHasSupport) {
      const supportContact = {
        uid: supportUid,
        displayName: 'Study Support',
        photoURL: 'https://api.dicebear.com/5.x/thumbs/svg?seed=Angel',
        type: 'support',
      };

      addContactIfNotExists(authId, supportContact, SCREEN).catch((err) => {
        setSystemMessage({
          message: 'Could not add Study Support contact right now.',
          type: 'error',
        });
        console.error('Failed to add Study Support contact:', err);
      });
    }

    return cleanup;
  }, [authId, userData]);

  // Reset local UI when profile disappears (user switch / logout)
  useEffect(() => {
    if (userData) return;
    setActiveConversation(null);
    setActiveContact(null);
    setConversations([]);
    setShowDistressThermometer(false);
    setShowDistressPopup(false);
    setShowWarning(false);
    setActiveLeftList('conversations');
    setActiveRightList('match');
    setSystemMessage(null);
    setHasUnread(false);
  }, [userData]);

  // Subscribe to user's conversations (gated only on profile)
  useEffect(() => {
    if (!authId || !userData) return;

    const unsubscribe = listenToUserConversations(
      authId,
      (convoList) => {
        setConversations(convoList);
        const anyUnread = convoList.some((c) =>
          Array.isArray(c.hasUnreadBy) ? c.hasUnreadBy.includes(authId) : false
        );
        setHasUnread(Boolean(anyUnread));
      },
      SCREEN
    );

    return () => {
      unsubscribe?.();
    };
  }, [authId, userData]);

  // Helpers
  const isSupportConversation = useCallback((c) => {
    if (!c) return false;
    const users = Array.isArray(c.users) ? c.users : [];
    return (
      users.includes(SUPPORT_UID) ||
      c.recipient === SUPPORT_UID ||
      c.requester === SUPPORT_UID ||
      c.type === 'support'
    );
  }, []);

  const handleContactClick = useCallback((contact) => {
    if (userData?.chatDisabled) {
      setSystemMessage({
        message: 'Chat is suspended. You can open conversations and reach Study Support.',
        type: 'alert',
        cancelMessage: clearSystemMessage,
      });
    }
    setActiveContact(contact);
    setActiveRightList('match');
    setRightExpanded(true);
  }, [userData?.chatDisabled, clearSystemMessage]);

  const handleConversationClick = useCallback(async (convo) => {
    const supportConvo = isSupportConversation(convo);

    if (userData?.chatDisabled && !supportConvo) {
      setSystemMessage({
        message: 'Chat is suspended. You can open the Study Support conversation only.',
        type: 'alert',
        cancelMessage: clearSystemMessage,
      });
      return;
    }

    const hasConsented = Array.isArray(convo.consentBy) && convo.consentBy.includes(authId);
    const isRecipient = convo.recipient === authId;

    if (!convo.mutualConsent) {
      if (isRecipient && !hasConsented) {
        const contact =
          userData?.contacts?.find((c) => c.uid === convo.requester) || { displayName: 'Your match' };

        setSystemMessage({
          message: t.chatroom?.new_request?.replace?.('{name}', contact.displayName) || 'New conversation request.',
          type: 'info',
          action: async () => {
            if (acceptingConvoId === convo.docID) return;
            setAcceptingConvoId(convo.docID);
            try {
              const result = await acceptConversation(convo.docID, authId);
              if (result?.mutualConsent) {
                const otherUid = convo.users.find((uid) => uid !== authId);
                const nextContact =
                  userData?.contacts?.find((c) => c.uid === otherUid) || { uid: otherUid };

                setActiveConversation({ ...convo, otherUserUid: otherUid });
                await markConversationSeen(convo.docID, userData.authId);
                setActiveContact(nextContact);
                setActiveLeftList('conversations');
                setActiveRightList('match');
                setShowDistressThermometer(true);
              }
              clearSystemMessage();
            } catch (err) {
              setSystemMessage({
                message: 'Could not accept the conversation. Please try again.',
                type: 'error',
              });
              console.error('Failed to accept conversation:', err);
            } finally {
              setAcceptingConvoId(null);
            }
          },
          cancelMessage: clearSystemMessage,
        });
      } else {
        setSystemMessage({
          message: t.chatroom?.not_accepted || 'This conversation isn’t active yet.',
          type: 'alert',
          cancelMessage: clearSystemMessage,
        });
      }
      return;
    }

    if (activeConversation?.docID === convo.docID) {
      setSystemMessage({
        message: t.chatroom?.already_active || 'This conversation is already open.',
        type: 'info',
        cancelMessage: clearSystemMessage,
      });
      return;
    }

    const otherUid = convo.users.find((uid) => uid !== authId);
    const contact = userData?.contacts?.find((c) => c.uid === otherUid) || { uid: otherUid };

    try {
      setActiveConversation({ ...convo, otherUserUid: otherUid });
      setActiveContact(contact);
      setActiveRightList('match');
      setShowDistressThermometer(true);
      await markConversationSeen(convo.docID, authId);
    } catch (err) {
      setSystemMessage({
        message: 'Could not open the conversation right now.',
        type: 'error',
      });
      console.error('Open conversation failed:', err);
    }
  }, [
    userData?.chatDisabled,
    isSupportConversation,
    userData?.contacts,
    authId,
    activeConversation?.docID,
    clearSystemMessage,
    t.chatroom?.new_request,
    t.chatroom?.not_accepted,
    t.chatroom?.already_active,
    acceptingConvoId,
    userData?.authId
  ]);

  // Conversation-driven side effects (request/accept banners)
  useEffect(() => {
    const cleanup = effectLogger(SCREEN, 'ConvoSideEffects', {
      convos: conversations.length,
      hasUserData: !!userData,
    });
    if (!conversations.length || !userData) return cleanup;

    conversations.forEach((convo) => {
      const hasConsented = Array.isArray(convo.consentBy) && convo.consentBy.includes(authId);
      const isRecipient = convo.recipient === authId;

      // Incoming request banner
      if (isRecipient && !hasConsented && !convo.mutualConsent) {
        const senderContact =
          userData.contacts?.find((c) => c.uid === convo.requester) || { displayName: 'Your match' };

        setSystemMessage({
          message: t.chatroom?.new_request?.replace?.('{name}', senderContact.displayName) || 'New conversation request.',
          type: 'info',
          action: async () => {
            if (acceptingConvoId === convo.docID) return;
            setAcceptingConvoId(convo.docID);
            try {
              const result = await acceptConversation(convo.docID, authId, SCREEN);
              if (result?.mutualConsent) {
                const otherUid = convo.users.find((uid) => uid !== authId);
                const contact = userData.contacts?.find((c) => c.uid === otherUid) || { uid: otherUid };

                setActiveConversation({ ...convo, otherUserUid: otherUid });
                await markConversationSeen(convo.docID, authId);
                setActiveContact(contact);
                setActiveLeftList('conversations');
                setActiveRightList('match');
                setShowDistressThermometer(true);
              }
              clearSystemMessage();
            } catch (err) {
              setSystemMessage({
                message: 'Could not accept the conversation. Please try again.',
                type: 'error',
              });
              console.error('Failed to accept conversation:', err);
            } finally {
              setAcceptingConvoId(null);
            }
          },
          cancelMessage: clearSystemMessage,
        });
      }

      // Accepted by both but not yet opened/seen
      const unseenByUser = !Array.isArray(convo.seenBy) || !convo.seenBy.includes(authId);
      if (convo.mutualConsent && hasConsented && unseenByUser && (!activeConversation || activeConversation.docID !== convo.docID)) {
        const otherUid = convo.users.find((uid) => uid !== authId);
        const contact = userData.contacts?.find((c) => c.uid === otherUid) || { uid: otherUid };

        setSystemMessage({
          message: t.chatroom?.request_accepted?.replace?.('{name}', contact.displayName || 'Your match') || 'Conversation accepted.',
          type: 'success',
          action: async () => {
            try {
              await markConversationSeen(convo.docID, authId);
              setActiveConversation({ ...convo, otherUserUid: otherUid });
              setActiveContact(contact);
              setActiveLeftList('conversations');
              setActiveRightList('match');
              setShowDistressThermometer(true);
              clearSystemMessage();
            } catch (err) {
              setSystemMessage({
                message: 'Could not open the conversation right now.',
                type: 'error',
              });
              console.error('Open conversation failed:', err);
            }
          },
          cancelMessage: clearSystemMessage,
        });
      }
    });

    return cleanup;
  }, [conversations, userData, authId, activeConversation, clearSystemMessage, acceptingConvoId, t.chatroom?.new_request, t.chatroom?.request_accepted]);

  // New match banner
  useEffect(() => {
    const cleanup = effectLogger(SCREEN, 'MatchBanner', {
      showWelcomeMessage,
      matched: !!userData?.simpaticoMatch,
      hasSeenMatch: !!userData?.hasSeenMatch,
    });
    if (!userData || showWelcomeMessage) return cleanup;

    const matched = Boolean(userData.simpaticoMatch);
    const hasSeen = userData.hasSeenMatch;

    if (matched && !hasSeen) {
      setSystemMessage({
        message: t.chatroom?.new_match || 'You have a new match!',
        type: 'success',
        action: async () => {
          try {
            await updateUserProfile(authId, { hasSeenMatch: true }, SCREEN);
          } catch (err) {
            setSystemMessage({
              message: 'Could not update match status.',
              type: 'error',
            });
            console.error('Error updating profile with match alert seen:', err);
          }
          setSystemMessage(null);
        },
        cancelMessage: () => setSystemMessage(null),
      });
    }

    return cleanup;
  }, [authId, userData, showWelcomeMessage, t.chatroom?.new_match]);

  // Chat disabled banner (no hard gate)
  useEffect(() => {
    const cleanup = effectLogger(SCREEN, 'ChatDisabledBanner', {
      chatDisabled: !!userData?.chatDisabled,
    });

    if (userData?.chatDisabled) {
      setSystemMessage({
        message: 'Chat is currently suspended. You can still open conversations and reach Study Support.',
        type: 'alert',
        cancelMessage: () => setSystemMessage(null),
      });
    }

    return cleanup;
  }, [userData?.chatDisabled]);

  // Local state for distress value
  const [distressLevel, setDistressLevel] = useState(null);

  const handleDistressSelection = useCallback(async (value) => {
    setShowDistressThermometer(false);
    if (distressSubmitting) return;

    if (value >= 70 && userData?.authId) {
      try {
        setDistressSubmitting(true);
        setActiveConversation(null);
        setDistressLevel(value);
        setShowDistressPopup(true);

        await logDistressSelection(userData.authId, value);
        await sendDistressAlertEmail(userData, value);
        await disableChatForUser(userData.authId);
      } catch (err) {
        setSystemMessage({
          message: 'We couldn’t complete the alert. Please try again or contact support.',
          type: 'error',
        });
        console.error('Distress flow failed:', err);
      } finally {
        setDistressSubmitting(false);
      }
    }
  }, [userData?.authId, distressSubmitting]);

  const isMatched = Boolean(userData?.simpaticoMatch);

  return (
    <IconContext.Provider value={iconCtx}>
      {systemMessage && (
        <SystemMessage
          message={systemMessage.message}
          type={systemMessage.type}
          cancelMessage={clearSystemMessage}
          onClick={systemMessage.action}
          language={language}
        />
      )}

      <OverlayManager
        showWelcomeMessage={showWelcomeMessage}
        setShowWelcomeMessage={setShowWelcomeMessage}
        showDistressPopup={showDistressPopup}
        setShowDistressPopup={setShowDistressPopup}
        showWarning={showWarning}
        setShowWarning={setShowWarning}
        showDistressThermometer={showDistressThermometer}
        setShowDistressThermometer={setShowDistressThermometer}
        handleDistressSelection={handleDistressSelection}
        userData={userData}
        language={language}
        setLanguage={setLanguage}
        distressLevel={distressLevel}
      />

      <div className="chatroom">
        <LeftPanel
          expanded={leftExpanded}
          setExpanded={setLeftExpanded}
          activeList={activeLeftList}
          setActiveList={setActiveLeftList}
          userData={userData}
          isMatched={isMatched}
          activeContact={activeContact}
          activeConversation={activeConversation}
          setActiveConversation={setActiveConversation}
          setActiveContact={setActiveContact}
          setShowDistressThermometer={setShowDistressThermometer}
          handleConversationClick={handleConversationClick}
          onContactClick={handleContactClick}
          activeConvo={activeConversation ? [activeConversation] : []}
          conversations={conversations}
          setSystemMessage={setSystemMessage}
          language={language}
          hasUnread={hasUnread}
        />

        <MessageWindow
          userData={userData}
          activeConversation={activeConversation}
          handleTriggerWarning={() => setShowWarning(true)}
          isMatched={isMatched}
          language={language}
          // initialMessages removed — live listener handles it
          hasUnread={hasUnread}
          setSystemMessage={setSystemMessage}
          setHasUnread={setHasUnread}
        />

        <RightPanel
          expanded={rightExpanded}
          setExpanded={setRightExpanded}
          activeList={activeRightList}
          setActiveList={setActiveRightList}
          userData={userData}
          isMatched={isMatched}
          activeContact={activeContact}
          activeConversation={activeConversation}
          setActiveConversation={setActiveConversation}
          setActiveContact={setActiveContact}
          setShowDistressThermometer={setShowDistressThermometer}
          handleConversationClick={handleConversationClick}
          onContactClick={handleContactClick}
          activeConvo={activeConversation ? [activeConversation] : []}
          conversations={conversations}
          setSystemMessage={setSystemMessage}
          language={language}
          hasUnread={hasUnread}
        />
      </div>
    </IconContext.Provider>
  );
}
