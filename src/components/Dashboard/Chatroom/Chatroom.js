import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import './chatroom.css';
import { IconContext } from 'react-icons';
import OverlayManager from './OverlayManager';
import LeftPanel from './LeftPanel';
import MessageWindow from './MessageWindow';
import RightPanel from './RightPanel';
import SystemMessage from '../../SystemMessage/SystemMessage';
import { useAuth } from '../../UserAuth/AuthContext';
import {
  listenToConversations,
  getConversations,
  createConversation,
  submitDistressScore,
  trackPromptEvent,
} from '../../../services/matchService';
import { useConnection } from '../../../connection';
import { respondToConsent } from '../../../services/consentService';
import { updateUserProfile, addContactIfNotExists } from '../../../services/authService';
import { getSupportUid } from '../../../constants';
import { logEffectLifecycle } from '../../../helpers/telemetry';
import en from '../../../translations/en';
import { getMyAssessments } from '../../../services/assessmentService';
import { on, off } from '../../../realtime/client';

const SCREEN = 'Chatroom';
const WELCOME_SEEN_KEY = 'welcomeSeen';

function welcomeAlreadySeen() {
  try {
    return sessionStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

const effectLogger =
  process.env.NODE_ENV !== 'production' ? logEffectLifecycle : () => () => {};

async function markConversationSeen(convoId, uid) {
  const { markConversationSeen: markSeen } = await import('../../../services/messageService');
  return markSeen(convoId, uid);
}

export default function Chatroom({
  startConvoPrompt = false,
  onStartConvoPromptHandled,
  acceptedInvite = null,
  onAcceptedInviteHandled,
}) {
  const t = en;
  const iconCtx = useMemo(() => ({ className: 'react-icons-chatroom' }), []);

  const { user, userData, refreshAuth } = useAuth();
  const { status: connectionStatus, reconnectGeneration } = useConnection();
  const authId = user?.uid;

  const [showWelcomeMessage, setShowWelcomeMessageState] = useState(() => !welcomeAlreadySeen());
  const setShowWelcomeMessage = useCallback((next) => {
    setShowWelcomeMessageState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (!value) {
        try {
          sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
        } catch {
          // ignore
        }
      }
      return value;
    });
  }, []);
  const [showDistressThermometer, setShowDistressThermometer] = useState(false);
  const [showDistressPopup, setShowDistressPopup] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [activeLeftList, setActiveLeftList] = useState('conversations');
  const [activeRightList, setActiveRightList] = useState('match');
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);

  const [activeContact, setActiveContact] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const composerInputRef = useRef(null);
  const handledRequestIdsRef = useRef(new Set());
  const [pendingDistressAfterWelcome, setPendingDistressAfterWelcome] = useState(false);
  const [dueAssessmentCount, setDueAssessmentCount] = useState(0);
  const [dueNoticeDismissed, setDueNoticeDismissed] = useState(false);

  // Clear composer when switching conversations
  useEffect(() => {
    setDraftMessage('');
  }, [activeConversation?.docID]);

  const insertPromptText = useCallback((text, promptId) => {
    const chunk = String(text || '').trim();
    if (!chunk) return;
    setDraftMessage((prev) => {
      const cur = String(prev || '');
      if (!cur.trim()) return chunk;
      const needsSpace = !/\s$/.test(cur);
      return `${cur}${needsSpace ? ' ' : ''}${chunk}`;
    });
    // "send" = inserted into composer (starter used while composing a chat message)
    if (promptId) trackPromptEvent(promptId, 'send');
    requestAnimationFrame(() => composerInputRef.current?.focus?.());
  }, []);

  const [systemMessage, setSystemMessage] = useState(null);
  const clearSystemMessage = useCallback(() => setSystemMessage(null), []);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const startPromptShownRef = useRef(false);

  useEffect(() => {
    if (!startConvoPrompt) {
      startPromptShownRef.current = false;
      return;
    }
    if (startPromptShownRef.current) return;
    const match = userData?.simpaticoMatch;
    const matchUid = typeof match === 'string' ? match : match?.uid || match?.authId;
    if (!matchUid || !authId) return;
    startPromptShownRef.current = true;

    const name =
      (typeof match === 'object' && (match.displayName || match.display_name)) || 'your match';
    setShowWelcomeMessage(false);
    setLeftExpanded(true);
    setActiveLeftList('contacts');
    setActiveContact({
      uid: matchUid,
      displayName: name,
      photoURL: (typeof match === 'object' && (match.photoURL || match.photo_url)) || '',
      type: 'match',
    });
    setActiveRightList('match');
    setRightExpanded(true);
    setSystemMessage({
      message: t.chatroom.start_prompt.replace('{name}', name),
      type: 'confirm',
      actionLabel: 'Yes',
      cancelMessage: clearSystemMessage,
      action: async () => {
        const existing = (conversationsRef.current || []).find(
          (c) => Array.isArray(c.users) && c.users.includes(matchUid)
        );
        if (existing?.mutualConsent) {
          setActiveConversation({ ...existing, otherUserUid: matchUid });
          setShowDistressThermometer(true);
          return;
        }
        const showFollowUp = (message, type) => {
          setTimeout(() => {
            setSystemMessage({
              message,
              type,
              cancelMessage: clearSystemMessage,
            });
          }, 0);
        };
        if (existing) {
          showFollowUp(t.convo_btn.request_sent.replace('{name}', name), 'success');
          return;
        }
        try {
          const result = await createConversation(authId, matchUid);
          const convo = result?.conversation ?? result;
          if (!convo) throw new Error('No conversation returned');
          if (!convo.mutualConsent) {
            showFollowUp(t.convo_btn.request_sent.replace('{name}', name), 'success');
            return;
          }
          setActiveConversation({ ...convo, otherUserUid: matchUid });
          setShowDistressThermometer(true);
        } catch (err) {
          console.error('Failed to start match conversation:', err?.message || err);
          showFollowUp(t.convo_btn.error.replace('{name}', name), 'alert');
        }
      },
    });
    onStartConvoPromptHandled?.();
  }, [
    startConvoPrompt,
    userData?.simpaticoMatch,
    authId,
    t,
    clearSystemMessage,
    onStartConvoPromptHandled,
  ]);

  const [acceptingConvoId, setAcceptingConvoId] = useState(null);
  const [distressSubmitting, setDistressSubmitting] = useState(false);

  /** Don't open distress under the welcome overlay — queue until welcome is closed. */
  const openDistressThermometer = useCallback(() => {
    if (showWelcomeMessage) {
      setPendingDistressAfterWelcome(true);
      return;
    }
    setShowDistressThermometer(true);
  }, [showWelcomeMessage]);

  useEffect(() => {
    if (!showWelcomeMessage && pendingDistressAfterWelcome) {
      setPendingDistressAfterWelcome(false);
      setShowDistressThermometer(true);
    }
  }, [showWelcomeMessage, pendingDistressAfterWelcome]);

  useEffect(() => {
    if (!authId) return undefined;
    let cancelled = false;
    getMyAssessments()
      .then((list) => {
        if (cancelled) return;
        const due = (Array.isArray(list) ? list : []).filter(
          (a) => a.status === 'due' || a.status === 'overdue'
        );
        setDueAssessmentCount(due.length);
      })
      .catch(() => {
        if (!cancelled) setDueAssessmentCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [authId]);

  const dismissDueNotice = useCallback(() => {
    setDueNoticeDismissed(true);
  }, []);

  useEffect(() => {
    if (!authId || !userData) return;
    const cleanup = effectLogger(SCREEN, 'EnsureSupportContact', { uid: authId });
    const supportUid = getSupportUid();
    if (authId === supportUid) return cleanup();

    const hasContacts = Array.isArray(userData.contacts);
    const alreadyHasSupport = hasContacts
      ? userData.contacts.some((c) => c.uid === supportUid && c.type === 'support')
      : false;

    if (!alreadyHasSupport) {
      const supportContact = {
        uid: supportUid,
        displayName: 'Study Support',
        photoURL: 'https://api.dicebear.com/5.x/thumbs/svg?seed=Angel',
        type: 'support',
      };
      addContactIfNotExists(authId, supportContact)
        .then(() => refreshAuth?.())
        .catch((err) => {
          setSystemMessage({ message: 'Could not add Study Support contact right now.', type: 'error' });
          console.error('Failed to add Study Support contact:', err);
        });
    }

    // If matched but match isn't in contacts (common after rematch / partial data), hydrate it
    const match = userData.simpaticoMatch;
    const matchUid =
      typeof match === 'string' ? match : match?.uid || match?.authId || null;
    if (matchUid && matchUid !== authId) {
      const hasMatchContact = hasContacts
        ? userData.contacts.some((c) => c?.uid === matchUid)
        : false;
      if (!hasMatchContact) {
        const matchContact = {
          uid: matchUid,
          displayName:
            (typeof match === 'object' &&
              (match.displayName || match.display_name || match.email)) ||
            '',
          photoURL:
            (typeof match === 'object' && (match.photoURL || match.photo_url)) || '',
          type: 'match',
        };
        addContactIfNotExists(authId, matchContact)
          .then(() => refreshAuth?.())
          .catch((err) => {
            console.warn('Failed to hydrate match contact:', err);
          });
      }
    }

    return cleanup;
  }, [authId, userData, refreshAuth]);

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

  useEffect(() => {
    if (!authId || !userData) return;

    const unsubscribe = listenToConversations((convoList) => {
      setConversations(convoList);
      setActiveConversation((cur) => {
        if (!cur?.docID) return cur;
        const next = convoList.find((c) => (c.docID || c.cid) === cur.docID);
        return next ? { ...cur, ...next, docID: next.docID || next.cid || cur.docID } : cur;
      });
      const anyUnread = convoList.some((c) =>
        Array.isArray(c.hasUnreadBy) ? c.hasUnreadBy.includes(authId) : false
      );
      setHasUnread(Boolean(anyUnread));
    });

    return () => unsubscribe?.();
  }, [authId, userData]);

  useEffect(() => {
    const handler = (payload) => {
      const id = payload?.conversationId;
      if (!id) return;
      setConversations((prev) => prev.filter((c) => (c.docID || c.cid) !== id));
      setActiveConversation((cur) => ((cur?.docID || cur?.cid) === id ? null : cur));
    };
    on('conversationDeleted', handler);
    return () => off('conversationDeleted', handler);
  }, []);

  // Sync conversations (and unread) when we reconnect after backoff
  useEffect(() => {
    if (!authId || !userData || reconnectGeneration < 1) return;
    getConversations()
      .then((list) => {
        const convoList = Array.isArray(list) ? list : [];
        setConversations(convoList);
        setActiveConversation((cur) => {
          if (!cur?.docID) return cur;
          const next = convoList.find((c) => (c.docID || c.cid) === cur.docID);
          return next ? { ...cur, ...next, docID: next.docID || next.cid || cur.docID } : cur;
        });
        const anyUnread = convoList.some((c) =>
          Array.isArray(c.hasUnreadBy) ? c.hasUnreadBy.includes(authId) : false
        );
        setHasUnread(Boolean(anyUnread));
      })
      .catch((err) => console.warn('Reconnect sync conversations failed:', err));
  }, [authId, userData, reconnectGeneration]);

  const isSupportConversation = useCallback((c) => {
    if (!c) return false;
    const users = Array.isArray(c.users) ? c.users : [];
    return (
      users.includes(getSupportUid()) ||
      c.recipient === getSupportUid() ||
      c.requester === getSupportUid() ||
      c.type === 'support'
    );
  }, []);

  const handleContactClick = useCallback(
    (contact) => {
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
    },
    [userData?.chatDisabled, clearSystemMessage]
  );

  const handleConversationClick = useCallback(
    async (convo) => {
      const supportConvo = isSupportConversation(convo);

      if (userData?.chatDisabled && !supportConvo) {
        setSystemMessage({
          message: 'Chat is suspended. You can open the Study Support conversation only.',
          type: 'alert',
          cancelMessage: clearSystemMessage,
        });
        return;
      }

      const consentBy = convo.consentBy ?? convo.consentGivenBy;
      const hasConsented = Array.isArray(consentBy) && consentBy.includes(authId);
      const isRecipient = convo.recipient === authId;

      if (!convo.mutualConsent) {
        if (isRecipient && !hasConsented) {
          const contact =
            userData?.contacts?.find((c) => c.uid === convo.requester) || {
              displayName: convo.otherDisplayName || 'your match',
            };

          setSystemMessage({
            message:
              t.chatroom?.new_request?.replace?.('{name}', contact.displayName) ||
              'New conversation request.',
            type: 'info',
            action: async () => {
              if (acceptingConvoId === convo.docID) return;
              setAcceptingConvoId(convo.docID);
              try {
                const result = await respondToConsent(convo.docID, true);
                handledRequestIdsRef.current.add(convo.docID);
                if (result?.mutualConsent) {
                  const otherUid = convo.users.find((uid) => uid !== authId);
                  const nextContact =
                    userData?.contacts?.find((c) => c.uid === otherUid) || { uid: otherUid };

                  setActiveConversation({
                    ...convo,
                    otherUserUid: otherUid,
                    mutualConsent: true,
                  });
                  await markConversationSeen(convo.docID, userData.authId);
                  setActiveContact(nextContact);
                  setActiveLeftList('conversations');
                  setActiveRightList('prompts');
                  openDistressThermometer();
                }
              } catch (err) {
                setSystemMessage({
                  message: 'Could not accept the conversation. Please try again.',
                  type: 'error',
                });
                console.error('Failed to accept conversation:', err);
                throw err;
              } finally {
                setAcceptingConvoId(null);
              }
            },
            cancelMessage: () => {
              handledRequestIdsRef.current.add(convo.docID);
              clearSystemMessage();
            },
          });
        } else {
          setSystemMessage({
            message: t.chatroom?.not_accepted || "This conversation isn't active yet.",
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
        setActiveRightList('prompts');
        openDistressThermometer();
        try {
          await markConversationSeen(convo.docID, authId);
        } catch (seenErr) {
          // Opening the chat succeeded; seen-state is best-effort (e.g. admin viewing)
          console.warn('markConversationSeen failed:', seenErr);
        }
      } catch (err) {
        setSystemMessage({ message: 'Could not open the conversation right now.', type: 'error' });
        console.error('Open conversation failed:', err);
      }
    },
    [
      userData?.chatDisabled,
      isSupportConversation,
      userData?.contacts,
      authId,
      activeConversation?.docID,
      clearSystemMessage,
      openDistressThermometer,
      t.chatroom?.new_request,
      t.chatroom?.not_accepted,
      t.chatroom?.already_active,
      acceptingConvoId,
      userData?.authId,
    ]
  );

  useEffect(() => {
    const cleanup = effectLogger(SCREEN, 'ConvoSideEffects', {
      convos: conversations.length,
      hasUserData: !!userData,
    });
    if (!conversations.length || !userData) return cleanup();

    conversations.forEach((convo) => {
      const consentBy = convo.consentBy ?? convo.consentGivenBy;
      const hasConsented = Array.isArray(consentBy) && consentBy.includes(authId);
      const isRecipient = convo.recipient === authId;

      // Pending incoming request — ask once to accept (not the "accepted" notice)
      if (isRecipient && !hasConsented && !convo.mutualConsent) {
        if (handledRequestIdsRef.current.has(convo.docID)) return;

        const senderContact =
          userData.contacts?.find((c) => c.uid === convo.requester) || {
            displayName: convo.otherDisplayName || 'your match',
          };

        setSystemMessage({
          message:
            t.chatroom?.new_request?.replace?.('{name}', senderContact.displayName) ||
            'New conversation request.',
          type: 'info',
          action: async () => {
            if (acceptingConvoId === convo.docID) return;
            setAcceptingConvoId(convo.docID);
            try {
              const result = await respondToConsent(convo.docID, true);
              handledRequestIdsRef.current.add(convo.docID);
              if (result?.mutualConsent) {
                const otherUid = convo.users.find((uid) => uid !== authId);
                const contact =
                  userData.contacts?.find((c) => c.uid === otherUid) || { uid: otherUid };

                setActiveConversation({
                  ...convo,
                  otherUserUid: otherUid,
                  mutualConsent: true,
                });
                await markConversationSeen(convo.docID, authId);
                setActiveContact(contact);
                setActiveLeftList('conversations');
                setActiveRightList('prompts');
                openDistressThermometer();
              }
            } catch (err) {
              setSystemMessage({
                message: 'Could not accept the conversation. Please try again.',
                type: 'error',
              });
              console.error('Failed to accept conversation:', err);
              throw err;
            } finally {
              setAcceptingConvoId(null);
            }
          },
          cancelMessage: () => {
            handledRequestIdsRef.current.add(convo.docID);
            clearSystemMessage();
          },
        });
      }
    });

    return cleanup;
  }, [
    conversations,
    userData,
    authId,
    clearSystemMessage,
    acceptingConvoId,
    openDistressThermometer,
    t.chatroom?.new_request,
  ]);

  const acceptedShownRef = useRef(null);
  useEffect(() => {
    const id = acceptedInvite?.id;
    if (!id || !authId) return;
    if (acceptedShownRef.current === id) return;
    acceptedShownRef.current = id;

    const convo = acceptedInvite.conversation || {};
    const name = acceptedInvite.name || 'your match';
    const otherUid =
      acceptedInvite.otherUid ||
      (Array.isArray(convo.users) ? convo.users.find((uid) => uid !== authId) : null);

    setShowWelcomeMessage(false);
    setLeftExpanded(true);
    setActiveLeftList('conversations');
    setSystemMessage({
      message: t.chatroom.request_accepted.replace('{name}', name),
      type: 'confirm',
      actionLabel: 'Open',
      cancelMessage: () => {
        clearSystemMessage();
        onAcceptedInviteHandled?.();
      },
      action: async () => {
        const contact =
          userData?.contacts?.find((c) => c.uid === otherUid) || {
            uid: otherUid,
            displayName: name,
            type: 'match',
          };
        setActiveConversation({
          ...convo,
          docID: id,
          otherUserUid: otherUid,
          mutualConsent: true,
        });
        setActiveContact(contact);
        setActiveLeftList('conversations');
        setActiveRightList('prompts');
        setRightExpanded(true);
        openDistressThermometer();
        try {
          await markConversationSeen(id, authId);
        } catch (err) {
          console.warn('markConversationSeen failed:', err);
        }
      },
    });
  }, [
    acceptedInvite,
    authId,
    userData?.contacts,
    t.chatroom?.request_accepted,
    clearSystemMessage,
    openDistressThermometer,
    onAcceptedInviteHandled,
  ]);

  const showGettingStarted =
    !!userData &&
    !userData.admin &&
    !userData.isSupport &&
    Boolean(userData.simpaticoMatch) &&
    !userData.hasSeenMatch;

  const handleDismissGettingStarted = useCallback(async () => {
    try {
      await updateUserProfile(authId, { hasSeenMatch: true });
      await refreshAuth?.();
    } catch (err) {
      setSystemMessage({
        message: 'Could not save. Please try again.',
        type: 'error',
      });
      console.error('Getting started dismiss failed:', err);
      throw err;
    }
  }, [authId, refreshAuth]);

  const [distressLevel, setDistressLevel] = useState(null);
  const [distressNotifyFailed, setDistressNotifyFailed] = useState(false);

  useEffect(() => {
    const cleanup = effectLogger(SCREEN, 'ChatDisabledBanner', {
      chatDisabled: !!userData?.chatDisabled,
    });
    if (userData?.chatDisabled && !distressNotifyFailed) {
      setSystemMessage({
        message:
          'Chat is currently suspended. You can still open conversations and reach Study Support.',
        type: 'alert',
        cancelMessage: () => setSystemMessage(null),
      });
    }
    return cleanup;
  }, [userData?.chatDisabled, distressNotifyFailed]);

  const handleDistressSelection = useCallback(
    async (value) => {
      setShowDistressThermometer(false);
      if (distressSubmitting) return;
      if (typeof value !== 'number' || !userData?.authId) return;

      try {
        setDistressSubmitting(true);
        const result = await submitDistressScore(value);

        if (value >= 70) {
          const notifyFailed = !!result?.notifyFailed;
          setDistressNotifyFailed(notifyFailed);
          setActiveConversation(null);
          setDistressLevel(value);
          setShowDistressPopup(true);
          try {
            await refreshAuth?.();
          } catch (refreshErr) {
            console.warn('Auth refresh after distress failed:', refreshErr);
          }
          if (notifyFailed) {
            setSystemMessage({
              message:
                'Chat is suspended and safety resources are shown, but we could not notify the study team. Please contact Study Support.',
              type: 'error',
            });
          }
        }
      } catch (err) {
        setSystemMessage({
          message: "We couldn't complete the alert. Please try again or contact support.",
          type: 'error',
        });
        console.error('Distress flow failed:', err);
      } finally {
        setDistressSubmitting(false);
      }
    },
    [userData?.authId, distressSubmitting, refreshAuth]
  );

  const isMatched = Boolean(userData?.simpaticoMatch);

  return (
    <IconContext.Provider value={iconCtx}>
      {systemMessage && (
        <SystemMessage
          message={systemMessage.message}
          type={systemMessage.type}
          cancelMessage={systemMessage.cancelMessage || clearSystemMessage}
          onClick={systemMessage.action}
          actionLabel={systemMessage.actionLabel || 'OK'}
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
        distressLevel={distressLevel}
        distressNotifyFailed={distressNotifyFailed}
      />

      <div
        className={`chatroom${connectionStatus === 'reconnecting' ? ' has-reconnect-banner' : ''}`}
      >
        {connectionStatus === 'reconnecting' && (
          <div className="reconnecting-banner" role="status">
            Reconnecting…
          </div>
        )}
        {dueAssessmentCount > 0
          && !dueNoticeDismissed
          && !showDistressThermometer
          && !showDistressPopup
          && !showWarning
          && (userData?.admin || !showWelcomeMessage)
          && createPortal(
          <div className="assessment-due-overlay" role="dialog" aria-labelledby="assessment-due-title">
            <div className="assessment-due-modal">
              <h2 id="assessment-due-title">
                {en.assessments.dueBanner.replace('{count}', String(dueAssessmentCount))}
              </h2>
              <div className="assessment-due-modal-actions">
                <button type="button" className="assessment-due-later" onClick={dismissDueNotice}>
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
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
          hasUnread={!showWelcomeMessage && hasUnread}
          showUnreadBadges={!showWelcomeMessage}
        />

        <MessageWindow
          userData={userData}
          activeConversation={activeConversation}
          reconnectGeneration={reconnectGeneration}
          handleTriggerWarning={() => setShowWarning(true)}
          isMatched={isMatched}
          hasUnread={hasUnread}
          setSystemMessage={setSystemMessage}
          setHasUnread={setHasUnread}
          draftMessage={draftMessage}
          onDraftChange={setDraftMessage}
          composerInputRef={composerInputRef}
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
          hasUnread={hasUnread}
          onInsertStarter={insertPromptText}
          showGettingStarted={showGettingStarted}
          onDismissGettingStarted={handleDismissGettingStarted}
        />
      </div>
    </IconContext.Provider>
  );
}
