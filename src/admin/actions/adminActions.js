// admin/actions/adminActions.js (or wherever your pair/unpair lives)
import { doc, runTransaction, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../fb';

const TS = () => serverTimestamp();

const matchUid = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object') return v.uid || v.authId || null;
  return null;
};

// Build the embedded object for simpaticoMatch, stripping heavy/recursive fields.
const projectUserForMatch = (uid, data) => {
  if (!data) return { uid };
  const {
    simpaticoMatch,
    matchedUserId,
    contacts,            // ⬅️ EXCLUDED explicitly
    UserConversations,   // (if present in your schema)
    password,            // just in case
    confirmPassword,     // just in case
    // add any other bulky/admin-only fields you never want to embed
    ...rest
  } = data;
  return { uid, ...rest };
};

const makeContact = (uid, data, type = 'match') => ({
  uid,
  displayName: data?.displayName || 'Unnamed',
  photoURL: data?.photoURL || '',
  type,
  lastContacted: new Date(), // fine to be client time for a UI hint
});

/**
 * Pair two users:
 * - Validates neither is matched to a different user (throws {code:'ALREADY_MATCHED'})
 * - Writes BOTH sides: matchedUserId, simpaticoMatch (embedded, no contacts), hasSeenMatch:false
 * - Adds each other as a contact (type: 'match') if not already present
 * - Does NOT touch conversation docs
 */
export async function pairUsers(aUid, bUid) {
  if (!aUid || !bUid) throw new Error('pairUsers: both UIDs required');
  if (aUid === bUid) throw new Error('pairUsers: cannot match user to themselves');

  const aRef = doc(db, 'users', aUid);
  const bRef = doc(db, 'users', bUid);

  await runTransaction(db, async (tx) => {
    const aSnap = await tx.get(aRef);
    const bSnap = await tx.get(bRef);
    if (!aSnap.exists()) throw new Error(`pairUsers: user ${aUid} not found`);
    if (!bSnap.exists()) throw new Error(`pairUsers: user ${bUid} not found`);

    const aData = aSnap.data();
    const bData = bSnap.data();

    const aCurrent = matchUid(aData.simpaticoMatch);
    const bCurrent = matchUid(bData.simpaticoMatch);

    if (aCurrent && aCurrent !== bUid) {
      const err = new Error(`User ${aUid} already matched with ${aCurrent}`);
      err.code = 'ALREADY_MATCHED';
      err.uid = aCurrent;
      throw err;
    }
    if (bCurrent && bCurrent !== aUid) {
      const err = new Error(`User ${bUid} already matched with ${bCurrent}`);
      err.code = 'ALREADY_MATCHED';
      err.uid = bCurrent;
      throw err;
    }

    const aEmbed = projectUserForMatch(aUid, aData);
    const bEmbed = projectUserForMatch(bUid, bData);

    // Dedupe contacts inside the transaction
    const aHasContact = Array.isArray(aData.contacts) && aData.contacts.some(c => c?.uid === bUid && c?.type === 'match');
    const bHasContact = Array.isArray(bData.contacts) && bData.contacts.some(c => c?.uid === aUid && c?.type === 'match');

    const aContact = makeContact(bUid, bData, 'match');
    const bContact = makeContact(aUid, aData, 'match');

    // Write both sides (merge keeps other profile fields intact)
    tx.set(
      aRef,
      {
        matchedUserId: bUid,
        simpaticoMatch: bEmbed,
        hasSeenMatch: false,  // ensures the “new match” banner shows for A
        updatedAt: TS(),
        ...(aHasContact ? {} : { contacts: arrayUnion(aContact) }),
      },
      { merge: true }
    );

    tx.set(
      bRef,
      {
        matchedUserId: aUid,
        simpaticoMatch: aEmbed,
        hasSeenMatch: false,  // ensures the “new match” banner shows for B
        updatedAt: TS(),
        ...(bHasContact ? {} : { contacts: arrayUnion(bContact) }),
      },
      { merge: true }
    );
  });

  return { ok: true };
}

/**
 * Unpair two users (clears both sides). Does not touch conversations.
 */
export async function unpairUsers(aUid, bUid) {
  if (!aUid || !bUid) throw new Error('unpairUsers: both UIDs required');
  if (aUid === bUid) throw new Error('unpairUsers: identical UIDs');

  const aRef = doc(db, 'users', aUid);
  const bRef = doc(db, 'users', bUid);

  await runTransaction(db, async (tx) => {
    const aSnap = await tx.get(aRef);
    const bSnap = await tx.get(bRef);
    if (!aSnap.exists() || !bSnap.exists()) throw new Error('unpairUsers: user not found');

    const aMatch = matchUid(aSnap.data().simpaticoMatch);
    const bMatch = matchUid(bSnap.data().simpaticoMatch);

    if (!(aMatch === bUid && bMatch === aUid)) {
      const err = new Error('Users are not paired with each other');
      err.code = 'NOT_PAIRED';
      throw err;
    }

    tx.set(aRef, { matchedUserId: null, simpaticoMatch: null, updatedAt: TS() }, { merge: true });
    tx.set(bRef, { matchedUserId: null, simpaticoMatch: null, updatedAt: TS() }, { merge: true });
  });

  return { ok: true };
}

/** Flip chat disabled flag. */
export async function toggleChat(uid, disabled) {
  if (!uid) throw new Error('toggleChat: uid required');
  await updateDoc(doc(db, 'users', uid), { chatDisabled: !!disabled, updatedAt: TS() });
  return { ok: true };
}
