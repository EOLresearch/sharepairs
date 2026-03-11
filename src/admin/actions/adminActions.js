import {
  updateMatch,
  removeMatch,
  enableChatForUser,
  disableChatForUser,
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
  if (!aUid || !bUid) throw new Error('unpairUsers: both UIDs required');
  if (aUid === bUid) throw new Error('unpairUsers: identical UIDs');
  await Promise.all([removeMatch(aUid), removeMatch(bUid)]);
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
