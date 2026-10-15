import {
  updateMatch,
  removeMatch,
  enableChatForUser,
  disableChatForUser,
  deleteUser as deleteUserApi,
  setConversationModeration,
  setConversationMonitor,
  addAdminMessageNote,
  addAdminConversationNote,
  addAdminUserNote,
  assignAdminConversation,
  deleteAdminConversation,
} from '../../services/matchService';

/**
 * Pair two users (admin). Delegates to API.
 */
export async function pairUsers(aUid, bUid) {
  if (!aUid || !bUid) throw new Error('pairUsers: both UIDs required');
  if (aUid === bUid) throw new Error('pairUsers: cannot match user to themselves');
  await updateMatch(aUid, bUid);
  return { ok: true };
}

/**
 * Unpair two users (admin). Removes match for both.
 */
export async function unpairUsers(aUid, bUid) {
  if (!aUid) throw new Error('unpairUsers: uid required');
  // Backend clears both sides from a single call
  await removeMatch(aUid);
  return { ok: true };
}

/**
 * Toggle chat disabled flag for a user (admin).
 */
export async function toggleChat(uid, disabled) {
  if (!uid) throw new Error('toggleChat: uid required');
  if (disabled) {
    await disableChatForUser(uid);
  } else {
    await enableChatForUser(uid);
  }
  return { ok: true };
}

/**
 * Hard-delete a user for re-registration testing.
 */
export async function deleteUser(uid) {
  if (!uid) throw new Error('deleteUser: uid required');
  return deleteUserApi(uid);
}

/**
 * Pause, resume, or terminate a conversation without unmatching.
 * status: 'active' | 'paused' | 'terminated'
 */
export async function deleteConversation(conversationId) {
  if (!conversationId) throw new Error('deleteConversation: conversationId required');
  return deleteAdminConversation(conversationId);
}

export async function setConvoModeration(conversationId, status) {
  if (!conversationId) throw new Error('setConvoModeration: conversationId required');
  await setConversationModeration(conversationId, status);
  return { ok: true, status };
}

/**
 * Pin, needs-review, or high-priority flags. Does not pause or terminate.
 */
export async function setConvoMonitor(conversationId, flags) {
  if (!conversationId) throw new Error('setConvoMonitor: conversationId required');
  return setConversationMonitor(conversationId, flags);
}

export async function addMessageNote(conversationId, messageId, body) {
  if (!conversationId || !messageId) throw new Error('addMessageNote: conversationId and messageId required');
  return addAdminMessageNote(conversationId, messageId, body);
}

export async function addConversationNote(conversationId, body) {
  if (!conversationId) throw new Error('addConversationNote: conversationId required');
  return addAdminConversationNote(conversationId, body);
}

export async function addUserNote(uid, body) {
  if (!uid) throw new Error('addUserNote: uid required');
  return addAdminUserNote(uid, body);
}

export async function assignConversation(conversationId, uid) {
  if (!conversationId) throw new Error('assignConversation: conversationId required');
  return assignAdminConversation(conversationId, uid);
}
