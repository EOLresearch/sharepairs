export const MODERATION_STATUSES = ['active', 'paused', 'terminated'];

export function normalizeModerationStatus(row) {
  const raw = typeof row === 'string' ? row : row?.moderation_status || row?.moderationStatus;
  if (raw === 'paused' || raw === 'terminated') return raw;
  return 'active';
}

export function isSupportConversation(convo, supportUid) {
  if (!convo) return false;
  const users = Array.isArray(convo.users) ? convo.users : [];
  return (
    convo.type === 'support' ||
    (supportUid &&
      (users.includes(supportUid) ||
        convo.recipient === supportUid ||
        convo.requester === supportUid))
  );
}

/**
 * Peer messaging is blocked when the study team paused or terminated the conversation.
 * Support threads are never blocked by this flag.
 */
export function isMessagingBlocked(convo, { isSupport = false } = {}) {
  if (isSupport) return false;
  const status = normalizeModerationStatus(convo);
  return status === 'paused' || status === 'terminated';
}

export function messagingBlockedMessage(convo) {
  const status = normalizeModerationStatus(convo);
  if (status === 'paused') {
    return 'This conversation is paused. You cannot send messages until the study team resumes it.';
  }
  if (status === 'terminated') {
    return 'This conversation has been ended. You cannot send new messages.';
  }
  return '';
}
