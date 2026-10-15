import React, { useEffect, useState, useRef, useCallback } from 'react';
import ChatMessage from '../ChatMessage/ChatMessage';
import {
  listenToMessages,
  getMessages,
  sendMessage as sendChatMessage,
  fetchOlderMessages,
  markConversationSeen,
} from '../../../services/messageService';
import { getSupportUid } from '../../../constants';

import en from '../../../translations/en';
import WaitingHub from './WaitingHub';
import {
  isConversationMessagingBlocked,
  moderationBannerText,
  moderationStatusOf,
} from '../../../helpers/conversationModeration';
import { hasBannedWord } from '../../../helpers/badWords';
import BlurredText from '../ChatMessage/BlurredText';

export default function MessageWindow({
  userData,
  handleTriggerWarning,
  activeConversation,
  reconnectGeneration = 0,
  initialMessages,
  hasUnread,
  setHasUnread,
  setSystemMessage,
  draftMessage,
  onDraftChange,
  composerInputRef,
}) {
  const t = en.messageWindow;

  const isAdmin = Boolean(userData?.admin);
  const [localMessage, setLocalMessage] = useState('');
  const controlled = typeof onDraftChange === 'function';
  const message = controlled ? (draftMessage ?? '') : localMessage;
  const setMessage = controlled ? onDraftChange : setLocalMessage;
  const [messages, setMessages] = useState([]);
  const [loadedConvoId, setLoadedConvoId] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const contentRef = useRef(null);

  const convoId = activeConversation?.docID || null;
  // Derive loading from convo identity so the spinner shows on the first paint
  // after switching threads (useEffect-only flags flash the empty state first).
  const messagesLoading = Boolean(convoId) && loadedConvoId !== convoId;

  useEffect(() => {
    if (!convoId || !messages?.length || messagesLoading) return;
    const last = messages[messages.length - 1];
    if (last?.sentFromUid && last.sentFromUid !== userData?.authId) {
      markConversationSeen(convoId, userData.authId).catch((e) =>
        console.warn('markConversationSeen failed:', e)
      );
    }
  }, [messages, convoId, userData?.authId, messagesLoading]);

  useEffect(() => {
    if (initialMessages?.length && convoId) {
      setMessages(initialMessages);
      setLastDoc(null);
      setHasMore(initialMessages.length >= 10);
      setHasUnread(false);
      setLoadedConvoId(convoId);
    }
  }, [initialMessages, setHasUnread, convoId]);

  useEffect(() => {
    if (!convoId) {
      setMessages([]);
      setLoadedConvoId(null);
      setLastDoc(null);
      setHasMore(false);
      return undefined;
    }

    // Drop the previous thread immediately.
    setMessages([]);
    setLastDoc(null);
    setHasMore(false);

    let cancelled = false;
    const unsub = listenToMessages(convoId, (liveMsgs) => {
      if (cancelled) return;
      setMessages((prev) => {
        if (
          prev.length &&
          liveMsgs.length &&
          prev[prev.length - 1]?.mid === liveMsgs[liveMsgs.length - 1]?.mid
        ) {
          return liveMsgs;
        }
        const serverClientIds = new Set(liveMsgs.map((m) => m.clientId).filter(Boolean));
        const stillSending = prev.filter(
          (m) => m.status === 'sending' && m.clientId && !serverClientIds.has(m.clientId)
        );
        return [...liveMsgs, ...stillSending];
      });
      setHasUnread(false);
      setLoadedConvoId(convoId);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [convoId, setHasUnread]);

  // Sync messages when we reconnect after backoff
  useEffect(() => {
    if (!convoId || reconnectGeneration < 1) return;
    getMessages(convoId)
      .then((msgs) => {
        setMessages(Array.isArray(msgs) ? msgs : []);
        setLoadedConvoId(convoId);
      })
      .catch(() => {});
  }, [convoId, reconnectGeneration]);

  useEffect(() => {
    if (messagesLoading) return;
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages, messagesLoading]);

  const handleLoadMore = async () => {
    if (!activeConversation?.docID) return;
    const { messages: olderMessages, lastDoc: newLastDoc, hasMore: more } = await fetchOlderMessages(
      activeConversation.docID,
      lastDoc
    );
    setMessages((prev) => [...olderMessages, ...prev]);
    setLastDoc(newLastDoc);
    setHasMore(more);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !activeConversation?.docID) return;
    // Distress suspend: do not send when chat is disabled unless support convo or admin
    const canSend =
      !userData?.chatDisabled ||
      userData?.admin ||
      isSupportConversation(activeConversation);
    if (!canSend) {
      setSystemMessage?.({
        type: 'alert',
        message: 'Chat is suspended. You cannot send messages until the study team re-enables access.',
      });
      return;
    }

    const peerBlocked =
      isConversationMessagingBlocked(activeConversation) &&
      !isSupportConversation(activeConversation);
    if (peerBlocked) {
      const status = moderationStatusOf(activeConversation);
      setSystemMessage?.({
        type: 'alert',
        message: status === 'paused' ? t.pausedSend : t.terminatedSend,
      });
      return;
    }

    const body = message.trim();
    const clientId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const tempMsg = {
      mid: `temp-${clientId}`,
      clientId,
      body,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      sentFromUid: userData.authId,
      sentFromDisplayName: userData.displayName || '',
      status: 'sending',
    };

    setMessages((prev) => [...prev, tempMsg]);
    setMessage('');

    try {
      const result = await sendChatMessage(activeConversation.docID, {
        body,
        senderDisplayName: userData.displayName || '',
        clientId,
      });
      // Confirm locally even if WebSocket push is down (common on miswired study deploys)
      const saved = result?.message || result;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.clientId !== clientId) return m;
          return {
            ...m,
            ...(saved && typeof saved === 'object' ? saved : {}),
            clientId,
            mid: saved?.mid || saved?.id || m.mid,
            status: 'sent',
            body: saved?.body || body,
            sentFromUid: saved?.sentFromUid || m.sentFromUid,
            sentFromDisplayName: saved?.sentFromDisplayName || m.sentFromDisplayName,
            createdAt: saved?.createdAt || m.createdAt,
          };
        })
      );
    } catch (err) {
      console.error('sendMessage failed:', err);
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      const msg = String(err?.message || err);
      if (msg.includes('UNAUTHENTICATED')) {
        setSystemMessage?.({ type: 'alert', message: 'Please sign in to send messages.' });
      } else if (msg.includes('PERMISSION_DENIED')) {
        setSystemMessage?.({ type: 'alert', message: "You're not a participant in this conversation." });
      } else if (msg.includes('paused') || msg.includes('ended')) {
        setSystemMessage?.({ type: 'alert', message: msg });
      } else if (msg.includes('NOT_FOUND') || msg.includes('conversation')) {
        setSystemMessage?.({ type: 'alert', message: 'Conversation not found.' });
      } else {
        setSystemMessage?.({ type: 'alert', message: "Couldn't send. Please try again." });
      }
    }
  };

  const isSupportConversation = useCallback((convo) => {
    if (!convo) return false;
    const users = Array.isArray(convo.users) ? convo.users : [];
    return (
      users.includes(getSupportUid()) ||
      convo.recipient === getSupportUid() ||
      convo.requester === getSupportUid() ||
      convo.type === 'support'
    );
  }, []);

  const chatDisabledForThisView =
    userData?.chatDisabled && !(isAdmin || isSupportConversation(activeConversation));

  if (chatDisabledForThisView) {
    return (
      <div className="message-window unmatched-placeholder">
        <div className="message-content">
          <h2>Chat Temporarily Disabled</h2>
          <p>
            A member of the study team will reach out to you soon.
            <br />
            You will be able to resume chatting once they've re-enabled access.
          </p>
        </div>
      </div>
    );
  }

  const allowWithoutMatch = isAdmin || isSupportConversation(activeConversation);

  if (!userData?.simpaticoMatch && !allowWithoutMatch) {
    return (
      <div className="message-window unmatched-placeholder">
        <div className="message-content">
          <WaitingHub displayName={userData.displayName} />
        </div>
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className="message-window unmatched-placeholder">
        <div className="message-content">
          <h2>{t.noConversationTitle}</h2>
          <p>{t.noConversationLine}</p>
        </div>
      </div>
    );
  }

  const peerMessagingBlocked =
    isConversationMessagingBlocked(activeConversation) &&
    !isSupportConversation(activeConversation);
  const moderationBanner = peerMessagingBlocked
    ? moderationBannerText(activeConversation)
    : '';
  const composerDisabled = messagesLoading || peerMessagingBlocked;
  const maskingComposer = hasBannedWord(message);

  return (
    <div className="message-window">
      {moderationBanner ? (
        <div
          className={`convo-moderation-banner ${moderationStatusOf(activeConversation)}`}
          role="status"
        >
          {moderationBanner}
        </div>
      ) : null}
      <div className="message-content" ref={contentRef}>
        {messagesLoading ? (
          <div className="messages-loading" role="status" aria-live="polite">
            <div className="messages-loading-spinner" aria-hidden="true" />
            <p>{t.loadingMessages}</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="load-more-wrapper">
                <button onClick={handleLoadMore} className="load-more-btn">
                  {t.loadMore}
                </button>
              </div>
            )}

            {messages.length > 0 ? (
              messages.map((msg) => (
                <ChatMessage
                  key={msg.mid}
                  message={msg}
                  currentUserId={userData.authId}
                  conversationId={activeConversation.docID}
                  canReport={!isSupportConversation(activeConversation)}
                  onReported={(updated) => {
                    if (!updated) return;
                    setMessages((prev) =>
                      prev.map((m) =>
                        (m.mid || m.id) === (updated.mid || updated.id)
                          ? { ...m, ...updated, reportedByMe: true }
                          : m
                      )
                    );
                  }}
                  setSystemMessage={setSystemMessage}
                />
              ))
            ) : (
              <div className="no-messages-placeholder">
                <img
                  src={`${process.env.PUBLIC_URL}/sharepairslogo.png`}
                  alt=""
                />
                <p className="no-messages-lead">No messages yet</p>
                <p className="no-messages-invite">Start the conversation!</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="message-input-wrapper">
        <div className={`message-composer${maskingComposer ? ' is-masking' : ''}`}>
          {maskingComposer && (
            <div className="composer-mirror" aria-hidden="true">
              <BlurredText text={message} />
            </div>
          )}
          <input
            ref={composerInputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              peerMessagingBlocked
                ? moderationStatusOf(activeConversation) === 'paused'
                  ? t.pausedSend
                  : t.terminatedSend
                : t.inputPlaceholder
            }
            disabled={composerDisabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
          />
        </div>
        <button onClick={handleSendMessage} disabled={composerDisabled}>
          {t.send}
        </button>
      </div>
    </div>
  );
}
