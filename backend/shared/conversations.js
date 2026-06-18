export function toConvoShape(row) {
  if (!row) return null;
  return {
    docID: row.id,
    cid: row.id,
    users: row.users,
    requester: row.requester,
    recipient: row.recipient,
    consentBy: row.consent_by,
    consentGivenBy: row.consent_by,
    mutualConsent: Boolean(row.mutual_consent),
    isClosed: Boolean(row.is_closed),
    hasUnreadBy: row.has_unread_by || [],
    lastMsgAt: row.last_msg_at,
    lastMsgPreview: row.last_msg_preview,
    lastSenderId: row.last_sender_id,
    seenBy: row.seen_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function notifyConversationUpdate(userIds, conversation) {
  const { broadcastToUsers } = await import('./broadcast.js');
  const shape = toConvoShape(conversation);
  await broadcastToUsers(userIds, {
    type: 'conversationUpdate',
    payload: { conversation: shape, timestamp: Date.now() },
  });
}
