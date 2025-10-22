// ---------- Firebase base ----------
import { app, db, auth } from '../fb';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  arrayUnion,
  arrayRemove,
  getCountFromServer,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ======================================================
// Constants & small utils
// ======================================================
export const SUPPORT_UID = 'ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1';
const now = () => serverTimestamp();
const sortPair = (a, b) => (a < b ? [a, b] : [b, a]);
export const buildConversationId = (u1, u2) => sortPair(String(u1), String(u2)).join('+');

// Small guard
const req = (v, name) => {
  if (v == null || v === '') throw new Error(`${name} required`);
  return v;
};

// ======================================================
// Users
// ======================================================

/** Live subscribe to a user's profile. Returns unsubscribe(). */
export function watchUserData(uid, cb) {
  if (!uid || typeof cb !== 'function') return () => {};
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? { authId: uid, ...snap.data() } : null));
}

/** Create/merge the user doc on signup. */
export async function createUserDoc(uid, email, details = {}, isAdmin = false) {
  const ref = doc(db, 'users', req(uid, 'uid'));
  const base = {
    authId: uid,
    email: email || '',
    admin: !!isAdmin,
    createdAt: now(),
    updatedAt: now(),
    ...details,
  };
  await setDoc(ref, base, { merge: true });
  return base;
}

/** Minimal contact object from a user doc. */
export function createContactObject(user, type = 'match') {
  const id = user?.uid || user?.authId;
  if (!id) return null;
  return {
    uid: id,
    displayName: user?.displayName || 'Unnamed',
    photoURL: user?.photoURL || '',
    type,
    lastContacted: new Date(),
  };
}

/** Add contact to a user if it doesn't already exist. */
export async function addContactIfNotExists(userUid, contactObj) {
  if (!userUid || !contactObj?.uid) return;
  const ref = doc(db, 'users', userUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const exists = Array.isArray(data.contacts)
    && data.contacts.some(c => c.uid === contactObj.uid && c.type === contactObj.type);

  if (!exists) {
    await updateDoc(ref, {
      contacts: arrayUnion(contactObj),
      updatedAt: now(),
    });
  }
}

/** Generic profile update. */
export async function updateUserProfile(uid, patch) {
  await updateDoc(doc(db, 'users', req(uid, 'uid')), {
    ...patch,
    updatedAt: now(),
  });
}

/** Toggle chat disabled flag on a user. */
export async function toggleChat(uid, disabled) {
  await updateDoc(doc(db, 'users', req(uid, 'uid')), {
    chatDisabled: !!disabled,
    updatedAt: now(),
  });
}
export const disableChatForUser = (uid) => toggleChat(uid, true);
export const enableChatForUser = (uid) => toggleChat(uid, false);

// ======================================================
// Conversations
//  - Schema (per doc /conversations/{cid}):
//    cid: "<uidA+uidB>" (sorted)
//    users: [uidA, uidB] (sorted)
//    requester, recipient
//    consentBy: { [uid]: true|false }
//    mutualConsent: boolean
//    isClosed: boolean
//    hasUnreadBy: [uid, ...]  // pill source (arrayUnion/arrayRemove)
//    lastMsgAt, lastMsgPreview, lastSenderId
//    createdAt, updatedAt
// ======================================================

/** Create or return existing conversation between two users. */
export async function createConversation(initiatorUid, otherUid) {
  const [a, b] = sortPair(req(initiatorUid, 'initiatorUid'), req(otherUid, 'otherUid'));
  const cid = buildConversationId(a, b);
  const ref = doc(db, 'conversations', cid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { docID: cid, ...snap.data() };

  const payload = {
    cid,
    users: [a, b],
    requester: initiatorUid,
    recipient: otherUid,
    consentBy: { [initiatorUid]: true, [otherUid]: false },
    mutualConsent: false,
    isClosed: false,
    hasUnreadBy: [],
    lastMsgAt: null,
    lastMsgPreview: null,
    lastSenderId: null,
    createdAt: now(),
    updatedAt: now(),
  };

  await setDoc(ref, payload);
  return { docID: cid, ...payload };
}

/** Accept a conversation (sets consent and mutual flag if both true). */
export async function acceptConversation(cid, uid) {
  req(cid, 'cid');
  req(uid, 'uid');
  const ref = doc(db, 'conversations', cid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Conversation not found');

  const data = snap.data() || {};
  const users = Array.isArray(data.users) ? data.users : [];
  const nextConsent = { ...(data.consentBy || {}), [uid]: true };
  const mutual = users.length === 2 && users.every((u) => nextConsent[u]);

  await updateDoc(ref, {
    consentBy: nextConsent,
    mutualConsent: !!mutual,
    updatedAt: now(),
  });

  return { mutualConsent: !!mutual };
}



/** Live list of a user's conversations (client sorts if needed). */
export function listenToUserConversations(uid, cb) {
  if (!uid || typeof cb !== 'function') return () => {};
  const q = query(collection(db, 'conversations'), where('users', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ docID: d.id, ...d.data() }));
    cb(rows);
  });
}

/** Mark conversation seen and clear unread pill for that uid. */
export async function markConversationSeen(cid, uid) {
  await updateDoc(doc(db, 'conversations', req(cid, 'cid')), {
    [`seenBy.${uid}`]: now(),
    hasUnreadBy: arrayRemove(uid),
    updatedAt: now(),
  });
}

export function convoHasUnreadForUser(convo, uid) {
  if (!convo || !uid) return false;

  // Fast path using hasUnreadBy
  if (Array.isArray(convo.hasUnreadBy) && convo.hasUnreadBy.includes(uid)) return true;

  // Fallback using timestamps if present
  const last = convo.lastMsgAt?.seconds || convo.lastMsgAt?._seconds || 0;
  const read = convo.lastReadAt?.[uid]?.seconds || convo.lastReadAt?.[uid]?._seconds || 0;

  // If last message is after my read timestamp and I wasn't the sender, it's unread
  if (last && last > read && convo.lastSenderId && convo.lastSenderId !== uid) return true;

  return false;
}

// Admin pulls (one-shot)
export async function fetchAllConversationsOnce() {
  const snap = await getDocs(collection(db, 'conversations'));
  return snap.docs.map((d) => ({ docID: d.id, ...d.data() }));
}
/** Back-compat name: */
export const getAllConversations = fetchAllConversationsOnce;

// ======================================================
// Messaging
//  - messages live under /conversations/{cid}/messages/{mid}
//  - We update parent convo’s lastMsg* + unread pill on send
// ======================================================

/** Append a message and update parent convo metadata. */
export async function sendMessage(cid, senderUid, body, senderDisplayName = '', clientId) {
  const parentRef = doc(db, 'conversations', cid);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists()) throw new Error('Conversation not found');
  const parent = parentSnap.data() || {};
  const users = Array.isArray(parent.users) ? parent.users : [];

  const now = serverTimestamp();

  // 1) create the message
  await addDoc(collection(parentRef, 'messages'), {
    body: String(body || ''),
    createdAt: now,
    sentFromUid: senderUid,
    sentFromDisplayName: senderDisplayName || '',
    status: 'sent',
    ...(clientId ? { clientId } : {})
  });

  // 2) update the conversation summary + unread flags
  const others = users.filter(u => u !== senderUid);
  await updateDoc(parentRef, {
    lastMsgAt: now,
    lastMsgPreview: String(body || '').slice(0, 140),
    lastSenderId: senderUid,
    hasUnreadBy: arrayUnion(...others),   // mark others as having unread
  });

  // Optional but nice: make sure sender is not considered unread
  await updateDoc(parentRef, { hasUnreadBy: arrayRemove(senderUid) });
}

/** Live stream messages ascending by createdAt. */
export function listenToMessages(cid, cb) {
  if (!cid || typeof cb !== 'function') return () => {};
  const q = query(collection(db, 'conversations', cid, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Fetch newest page (ascending list). */
export async function fetchRecentMessages(cid, pageSize = 10) {
  const qy = query(
    collection(db, 'conversations', req(cid, 'cid'), 'messages'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(qy);
  const desc = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    messages: desc.slice().reverse(), // old->new
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.size === pageSize,
  };
}

/** Fetch older page given lastDoc from fetchRecentMessages. */
export async function fetchOlderMessages(cid, lastDocRef, pageSize = 10) {
  if (!lastDocRef) return { messages: [], lastDoc: null, hasMore: false };
  const qy = query(
    collection(db, 'conversations', req(cid, 'cid'), 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(lastDocRef),
    limit(pageSize)
  );
  const snap = await getDocs(qy);
  const desc = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    messages: desc.slice().reverse(),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.size === pageSize,
  };
}

/** Mark all non-self 'sent' messages as 'read' (optional, if you keep per-message status). */
export async function markMessagesRead(cid, messages, currentUid) {
  // No-op here unless you want to update each message's status.
  // You already clear the pill via markConversationSeen.
  return { ok: true };
}

/** Fast count of unread (optional; requires indexes). */
export async function getUnreadMessageCount(cid, currentUid) {
  // Expensive; most UIs just use hasUnreadBy pill.
  // Keeping stub for compatibility.
  return 0;
}

// ======================================================
// Support-specific helpers
// ======================================================

/** Ensure the Study Support contact exists on a user. */
export async function ensureSupportContactFor(uid) {
  if (!uid || uid === SUPPORT_UID) return;
  const contact = createContactObject({ uid: SUPPORT_UID, displayName: 'Study Support', photoURL: 'https://api.dicebear.com/5.x/thumbs/svg?seed=Angel' }, 'support');
  if (contact) await addContactIfNotExists(uid, contact);
}

/** Create or return the support conversation (auto mutual). */
export async function createSupportConvoIfMissing(userUid) {
  req(userUid, 'userUid');
  const cid = buildConversationId(userUid, SUPPORT_UID);
  const ref = doc(db, 'conversations', cid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { docID: cid, ...snap.data() };

  const payload = {
    cid,
    users: sortPair(userUid, SUPPORT_UID),
    requester: userUid,
    recipient: SUPPORT_UID,
    consentBy: { [userUid]: true, [SUPPORT_UID]: true },
    mutualConsent: true,
    isClosed: false,
    hasUnreadBy: [],
    lastMsgAt: null,
    lastMsgPreview: null,
    lastSenderId: null,
    createdAt: now(),
    updatedAt: now(),
    type: 'support',
  };

  await setDoc(ref, payload);
  return { docID: cid, ...payload };
}

/** Get support convo if it already exists. */
export async function getSupportConvoIfExists(userUid) {
  const cid = buildConversationId(req(userUid, 'userUid'), SUPPORT_UID);
  const snap = await getDoc(doc(db, 'conversations', cid));
  return snap.exists() ? { docID: cid, ...snap.data() } : null;
}

// ======================================================
// Admin pulls
// ======================================================

export async function fetchAllUsersOnce() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export function watchAllUsers(cb) {
  return onSnapshot(collection(db, 'users'), (snap) =>
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
  );
}

// ======================================================
// Distress flow (Functions)
// ======================================================

export async function sendDistressAlertEmail(userData, level) {
  try {
    const functions = getFunctions(app, 'us-central1');
    const sendEmail = httpsCallable(functions, 'sendDistressEmail');
    await sendEmail({ level, user: userData });
    return { ok: true };
  } catch (err) {
    console.error('sendDistressAlertEmail failed:', err);
    throw err;
  }
}

export async function logDistressSelection(uid, level) {
  if (!uid || typeof level !== 'number') return;
  await addDoc(collection(doc(db, 'users', uid), 'distressLog'), {
    level,
    timestamp: now(),
  });
}

// ======================================================
// Back-compat exports (names your app already imports)
// ======================================================

/** Your app calls this name; it maps to updateUserProfile above. */
// export { updateUserProfile };

/** Your app calls listenToNewestMessage in places; optional alias to listenToMessages newest page */
export function listenToNewestMessage(cid, cb) {
  // Simple wrapper: just listen ascending and forward the last row.
  return listenToMessages(cid, (rows) => {
    const last = rows[rows.length - 1];
    if (last) cb(last);
  });
}
