import React, { useEffect, useState, useRef, useCallback } from 'react';
import ChatMessage from '../ChatMessage/ChatMessage';
import {
  listenToMessages,
  getMessages,
  sendMessage as sendChatMessage,
  fetchOlderMessages,
  markConversationSeen,
} from '../../../services/messageService';
import { SUPPORT_UID } from '../../../constants';

import en from '../../../translations/en';
import tr from '../../../translations/tr';

export default function MessageWindow({
  userData,
  handleTriggerWarning,
  activeConversation,
  reconnectGeneration = 0,
  language = 'en',
  initialMessages,
  hasUnread,
  setHasUnread,
  setSystemMessage,
}) {
  const t = language === 'tr' ? tr.messageWindow : en.messageWindow;

  const isAdmin = Boolean(userData?.admin);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!activeConversation?.docID || !messages?.length) return;
    const last = messages[messages.length - 1];
    if (last?.sentFromUid && last.sentFromUid !== userData?.authId) {
      markConversationSeen(activeConversation.docID, userData.authId).catch((e) =>
        console.warn('markConversationSeen failed:', e)
      );
    }
  }, [messages, activeConversation?.docID, userData?.authId]);

  useEffect(() => {
    if (initialMessages?.length) {
      setMessages(initialMessages);
      setLastDoc(null);
      setHasMore(initialMessages.length >= 10);
      setHasUnread(false);
    }
  }, [initialMessages, setHasUnread]);

  useEffect(() => {
    if (!activeConversation?.docID) return;

    const unsub = listenToMessages(activeConversation.docID, (liveMsgs) => {
      setMessages((prev) => {
        if (prev.length && liveMsgs.length && prev[prev.length - 1]?.mid === liveMsgs[liveMsgs.length - 1]?.mid) {
          return liveMsgs;
        }
        const serverClientIds = new Set(liveMsgs.map((m) => m.clientId).filter(Boolean));
        const stillSending = prev.filter(
          (m) => m.status === 'sending' && m.clientId && !serverClientIds.has(m.clientId)
        );
        return [...liveMsgs, ...stillSending];
      });
      setHasUnread(false);
    });

    return () => unsub?.();
  }, [activeConversation?.docID, setHasUnread]);

  // Sync messages when we reconnect after backoff
  useEffect(() => {
    if (!activeConversation?.docID || reconnectGeneration < 1) return;
    getMessages(activeConversation.docID)
      .then((msgs) => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => {});
  }, [activeConversation?.docID, reconnectGeneration]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages]);

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
      await sendChatMessage(activeConversation.docID, {
        body,
        senderDisplayName: userData.displayName || '',
        clientId,
      });
    } catch (err) {
      console.error('sendMessage failed:', err);
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      const msg = String(err?.message || err);
      if (msg.includes('UNAUTHENTICATED')) {
        setSystemMessage?.({ type: 'alert', message: 'Please sign in to send messages.' });
      } else if (msg.includes('PERMISSION_DENIED')) {
        setSystemMessage?.({ type: 'alert', message: "You're not a participant in this conversation." });
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
      users.includes(SUPPORT_UID) ||
      convo.recipient === SUPPORT_UID ||
      convo.requester === SUPPORT_UID ||
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
          <h2>{t.unmatchedTitle.replace('{name}', userData.displayName || 'there')}</h2>
          <p>{t.unmatchedLine1}</p>
          <p>{t.unmatchedLine2}</p>
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

  return (
    <div className="message-window">
      <div className="message-content" ref={contentRef}>
        {hasMore && (
          <div className="load-more-wrapper">
            <button onClick={handleLoadMore} className="load-more-btn">
              {t.loadMore}
            </button>
          </div>
        )}

        {messages.length > 0 ? (
          messages.map((msg) => (
            <ChatMessage key={msg.mid} message={msg} currentUserId={userData.authId} />
          ))
        ) : (
          <div className="no-messages-placeholder">{t.noMessages}</div>
        )}
      </div>

      <div className="message-input-wrapper">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.inputPlaceholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
        />
        <button onClick={handleSendMessage}>{t.send}</button>
      </div>
    </div>
  );
}
