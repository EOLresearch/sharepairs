// firebasehelpers.js (instrumented)

import { db, app } from '../fb';
import {
  collection,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
  startAfter,
  limit,
  arrayUnion,
  increment,
  getCountFromServer,
  // raw Firestore fns passed into telemetry wrappers:
  getDoc as _getDoc,
  getDocs as _getDocs,
  onSnapshot as _onSnapshot,
  addDoc as _addDoc,
  setDoc as _setDoc,
  updateDoc as _updateDoc
} from 'firebase/firestore';

import {
  getAuth,
  sendPasswordResetEmail,
  EmailAuthProvider,
} from 'firebase/auth';

import { getFunctions, httpsCallable } from "firebase/functions";

// 🔎 Telemetry
import {
  meter,
  iGetDoc,
  iGetDocs,
  iOnSnapshot,
  iAddDoc,
  iSetDoc,
  iUpdateDoc,
} from './telemetry';

const auth = getAuth();

/* ========== 🔁 User Data ========== */

export const listenToUserData = (uid, callback, screen) => {
  const userRef = doc(db, 'users', uid);
  return iOnSnapshot(_onSnapshot, userRef, callback, screen, (snap) => {
    if (snap.exists()) callback({ ...snap.data(), authId: uid });
  }, screen);
};

/* ========== 🔁 Conversations ========== */

// ✅ Get all conversations once (no real-time listener)
export const getAllConversations = async (screen) => {
  const snap = await iGetDocs(_getDocs, collection(db, 'conversations'), screen);
  return snap.docs.map(doc => ({
    docID: doc.id,
    ...doc.data()
  }));
};

export const checkOrCreateConversationWithConsent = async (sender, recipient, screen) => {
  const convoId = `${sender.authId}+${recipient.uid}`;
  const altConvoId = `${recipient.uid}+${sender.authId}`;

  let convoRef = doc(db, 'conversations', convoId);
  let convoSnap = await iGetDoc(_getDoc, convoRef, screen);

  if (!convoSnap.exists()) {
    convoRef = doc(db, 'conversations', altConvoId);
    convoSnap = await iGetDoc(_getDoc, convoRef, screen);
  }

  if (convoSnap.exists()) {
    const data = convoSnap.data();
    const hasConsented = data.consentGivenBy?.includes(sender.authId);
    if (!hasConsented) {
      await iUpdateDoc(_updateDoc, convoRef, {
        consentGivenBy: arrayUnion(sender.authId),
        mutualConsent: data.users.every(uid =>
          [...(data.consentGivenBy || []), sender.authId].includes(uid)
        ),
      }, screen);
    }
    return { conversation: { ...data, docID: convoRef.id }, created: false };
  }

  const conversation = {
    users: [sender.authId, recipient.uid],
    userData: { sender, receiver: recipient },
    recipient: recipient.uid,
    requester: sender.authId,
    createdAt: serverTimestamp(),
    docID: convoRef.id,
    mutualConsent: false,
    consentGivenBy: [sender.authId],
    lastSeen: {
      [sender.authId]: serverTimestamp(),
      [recipient.uid]: null
    }
  };

  await iSetDoc(_setDoc, convoRef, conversation, undefined, screen);
  return { conversation: { ...conversation, docID: convoRef.id }, created: true };
};

export const acceptConversationRequest = async (docID, uid, screen) => {
  try {
    const convoRef = doc(db, 'conversations', docID);
    const snap = await iGetDoc(_getDoc, convoRef, screen);
    if (!snap.exists()) throw new Error("Conversation not found.");

    const data = snap.data();
    const updatedConsent = [...(data.consentGivenBy || []), uid];
    const isMutual = data.users.every(userId => updatedConsent.includes(userId));

    await iUpdateDoc(_updateDoc, convoRef, {
      consentGivenBy: arrayUnion(uid),
      mutualConsent: isMutual,
      seenBy: arrayUnion(uid),
    }, screen);

    console.log(`✅ Conversation ${docID} updated with consent from ${uid}`);
    return { mutualConsent: isMutual };
  } catch (err) {
    console.error("❌ Error accepting conversation:", err.message);
    throw err;
  }
};

export const toggleMutualConsent = async (convoId, consentValue, screen) => {
  try {
    const convoRef = doc(db, 'conversations', convoId);
    await iUpdateDoc(_updateDoc, convoRef, { mutualConsent: consentValue }, screen);
    console.log("✅ Mutual consent updated.");
  } catch (err) {
    console.error("❌ Error toggling mutual consent:", err.message);
    throw err;
  }
};

export const listenForPendingConversationRequests = (uid, onRequest, screen) => {
  if (!uid || typeof onRequest !== 'function') return () => { };

  const q = query(
    collection(db, 'conversations'),
    where('recipient', '==', uid),
    where('mutualConsent', '==', false)
  );

  return iOnSnapshot(_onSnapshot, q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      const data = change.doc.data();
      const hasGivenConsent = (data.consentGivenBy || []).includes(uid);

      if (!hasGivenConsent) {
        console.log('📩 Incoming request for:', uid);
        onRequest({ ...data, docID: change.doc.id });
      }
    });
  }, screen);
};

export const listenForConversationConsentGranted = (uid, onConsent, screen) => {
  const q = query(
    collection(db, 'conversations'),
    where('users', 'array-contains', uid),
    where('mutualConsent', '==', true)
  );

  return iOnSnapshot(_onSnapshot, q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const alreadyOpened = data.consentGivenBy?.includes(uid) && data.mutualConsent;
        if (alreadyOpened) {
          onConsent({ ...data, docID: change.doc.id });
        }
      }
    });
  }, screen);
};

export const markConversationSeen = async (docID, uid, screen) => {
  try {
    const convoRef = doc(db, 'conversations', docID);
    const snap = await iGetDoc(_getDoc, convoRef, screen);
    if (!snap.exists()) throw new Error('Conversation not found');

    const data = snap.data();
    if (data.seenBy?.includes(uid)) return; // Already marked

    await iUpdateDoc(_updateDoc, convoRef, { seenBy: arrayUnion(uid) }, screen);
    console.log(`✅ Marked conversation ${docID} as seen by ${uid}`);
  } catch (err) {
    console.error(`❌ Error marking conversation seen:`, err.message);
  }
};

/* ========== 👥 Matching ========== */

export const watchForNewMatch = (uid, onNewMatch, screen) => {
  if (!uid || typeof onNewMatch !== 'function') return () => { };

  let previousMatchId = null;
  const userRef = doc(db, 'users', uid);

  const unsubscribe = iOnSnapshot(_onSnapshot, userRef, (snapshot) => {
    const data = snapshot.data();
    const currentMatchId = data?.simpaticoMatch?.authId || data?.simpaticoMatch?.uid || null;

    if (currentMatchId && currentMatchId !== previousMatchId) {
      previousMatchId = currentMatchId;
      onNewMatch(data.simpaticoMatch);
    }
  }, screen);

  return unsubscribe;
};

export const updateMatch = async (uid, matchUid, screen) => {
  if (uid === matchUid) {
    alert("❌ Cannot match user with themselves.");
    return;
  }

  try {
    const [userSnap, matchSnap] = await Promise.all([
      iGetDoc(_getDoc, doc(db, 'users', uid), screen),
      iGetDoc(_getDoc, doc(db, 'users', matchUid), screen)
    ]);

    if (!userSnap.exists() || !matchSnap.exists()) {
      throw new Error("User(s) not found.");
    }

    const user = userSnap.data();
    const match = matchSnap.data();

    const matchInfoForUser = { ...match };
    delete matchInfoForUser.contacts;
    delete matchInfoForUser.UserConversations;
    delete matchInfoForUser.password;
    delete matchInfoForUser.confirmPassword;

    const userInfoForMatch = { ...user };
    delete userInfoForMatch.contacts;
    delete userInfoForMatch.UserConversations;
    delete userInfoForMatch.password;
    delete userInfoForMatch.confirmPassword;

    const contactForUser = createContactObject({ ...match, uid: match.uid || match.authId }, 'match');
    const contactForMatch = createContactObject({ ...user, uid: user.uid || user.authId }, 'match');

    if (!contactForUser || !contactForMatch) {
      throw new Error("Invalid contact object.");
    }

    await Promise.all([
      iUpdateDoc(_updateDoc, doc(db, 'users', uid), { simpaticoMatch: matchInfoForUser }, screen),
      iUpdateDoc(_updateDoc, doc(db, 'users', matchUid), { simpaticoMatch: userInfoForMatch }, screen),
    ]);

    await addContactIfNotExists(uid, contactForUser, screen);
    await addContactIfNotExists(matchUid, contactForMatch, screen);

    console.log(`✅ Match set and detailed match info added for ${uid} and ${matchUid}`);
  } catch (err) {
    console.error("❌ Error setting match and adding contact:", err.message);
    throw err;
  }
};

export const removeMatch = async (uid, screen) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await iGetDoc(_getDoc, userRef, screen);
    if (!userSnap.exists()) throw new Error("User not found.");

    const userData = userSnap.data();
    const matchData = userData?.simpaticoMatch;
    if (!matchData || (!matchData.uid && !matchData.authId)) {
      console.warn("No existing match to remove.");
      return;
    }

    const matchUid = matchData.uid || matchData.authId;

    // Remove simpaticoMatch and contact from the current user
    const userContacts = Array.isArray(userData.contacts) ? userData.contacts : [];
    const filteredUserContacts = userContacts.filter(c => c.uid !== matchUid);
    await iUpdateDoc(_updateDoc, userRef, {
      simpaticoMatch: '',
      contacts: filteredUserContacts,
      hasSeenMatch: false,
    }, screen);

    // Remove simpaticoMatch and contact from the matched user
    const matchRef = doc(db, 'users', matchUid);
    const matchSnap = await iGetDoc(_getDoc, matchRef, screen);
    if (!matchSnap.exists()) {
      console.warn(`Match user (${matchUid}) not found — only removed from ${uid}`);
      return;
    }

    const matchDataSnap = matchSnap.data();
    const matchContacts = Array.isArray(matchDataSnap.contacts) ? matchDataSnap.contacts : [];
    const filteredMatchContacts = matchContacts.filter(c => c.uid !== uid);
    await iUpdateDoc(_updateDoc, matchRef, {
      simpaticoMatch: '',
      contacts: filteredMatchContacts,
      hasSeenMatch: false,
    }, screen);

    console.log(`✅ Match and contacts removed for both ${uid} and ${matchUid}`);
  } catch (err) {
    console.error("❌ Error removing match and contact:", err.message);
    throw err;
  }
};

/* ========== 🔐 Auth Utilities ========== */

export const reAuthenticate = async (email, password, onSuccess, onError) => {
  const user = auth.currentUser;
  if (!user) return onError("No user currently signed in.");

  try {
    const creds = EmailAuthProvider.credential(email, password);
    await user.reauthenticateWithCredential(creds);
    onSuccess();
  } catch (err) {
    console.error("❌ Reauthentication error:", err.message);
    onError(err.message);
  }
};

export const updateUserEmail = async (uid, newEmail, screen) => {
  const userRef = doc(db, 'users', uid);
  const currentUser = auth.currentUser;

  if (!currentUser) throw new Error("No authenticated user found.");

  try {
    await currentUser.updateEmail(newEmail);
    await currentUser.sendEmailVerification();
    await iUpdateDoc(_updateDoc, userRef, { email: newEmail }, screen);
    console.log("✅ Email updated and verification sent.");
  } catch (err) {
    console.error("❌ Error updating user email:", err.message);
    throw err;
  }
};

export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log("✅ Password reset email sent.");
  } catch (err) {
    console.error("❌ Error sending password reset:", err);
    throw err;
  }
};

export const updateUserProfile = async (uid, newData, screen) => {
  try {
    const userRef = doc(db, 'users', uid);
    await iUpdateDoc(_updateDoc, userRef, newData, screen);
    console.log("✅ User profile updated.");
  } catch (err) {
    console.error("❌ Error updating user profile:", err.message);
    throw err;
  }
};

/* ========== 📇 Contact Utilities ========== */

export const createContactObject = (user, type = 'conversation') => {
  const uid = user.uid || user.authId;
  if (!uid) {
    console.warn("🚫 Skipped adding contact — invalid object:", user);
    return null;
  }

  return {
    uid,
    displayName: user.displayName || 'Unnamed',
    photoURL: user.photoURL || '',
    type,
    lastContacted: new Date(),
  };
};

export const addContactIfNotExists = async (userUid, contactObj, screen) => {
  if (!contactObj?.uid) {
    console.warn("🚫 Skipped adding contact — invalid object:", contactObj);
    return;
  }

  const userRef = doc(db, 'users', userUid);
  const userSnap = await iGetDoc(_getDoc, userRef, screen);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const exists = userData.contacts?.some(
    c => c.uid === contactObj.uid && c.type === contactObj.type
  );
  if (exists) return;

  await iUpdateDoc(_updateDoc, userRef, { contacts: arrayUnion(contactObj) }, screen);
  console.log(`✅ Contact ${contactObj.uid} added to ${userUid}`);
};

export const listenToUserConversations = (uid, callback, screen) => {
  if (!uid || typeof callback !== 'function') {
    console.warn("🛑 listenToUserConversations requires valid uid and callback.");
    return () => { };
  }

  const q = query(
    collection(db, 'conversations'),
    where('users', 'array-contains', uid)
  );

  return iOnSnapshot(_onSnapshot, q, (snapshot) => {
    const conversations = [];
    snapshot.forEach(doc => {
      conversations.push({ ...doc.data(), docID: doc.id });
    });
    callback(conversations);
  }, screen);
};

export const fetchRecentMessages = async (convoId, pageSize = 10, screen) => {
  const messagesRef = collection(db, 'conversations', convoId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await iGetDocs(_getDocs, q, screen);
  const docs = snap.docs;

  return {
    messages: docs.map(d => ({ ...d.data(), mid: d.id })).reverse(),
    lastDoc: docs[docs.length - 1] || null,
    hasMore: docs.length === pageSize,
  };
};

export const fetchOlderMessages = async (convoId, lastDoc, pageSize = 10, screen) => {
  if (!lastDoc) return { messages: [], lastDoc: null, hasMore: false };

  const messagesRef = collection(db, 'conversations', convoId, 'messages');
  const q = query(
    messagesRef,
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc),
    limit(pageSize)
  );

  const snap = await iGetDocs(_getDocs, q, screen);
  const docs = snap.docs;

  return {
    messages: docs.map(d => ({ ...d.data(), mid: d.id })).reverse(),
    lastDoc: docs[docs.length - 1] || null,
    hasMore: docs.length === pageSize,
  };
};

export const listenToNewestMessage = (convoId, callback, screen) => {
  const messagesRef = collection(db, 'conversations', convoId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(1));

  return iOnSnapshot(_onSnapshot, q, (snapshot) => {
    const doc = snapshot.docs[0];
    if (doc) {
      const message = { ...doc.data(), mid: doc.id };
      callback(message);
    }
  }, screen);
};

export const sendMessage = async (convoId, sender, messageText, screen) => {
  const convoRef = doc(db, 'conversations', convoId);
  const messagesRef = collection(convoRef, 'messages');
  const msgRef = doc(messagesRef); // Auto-ID on setDoc

  const message = {
    mid: msgRef.id,
    body: messageText,
    createdAt: serverTimestamp(),
    sentFromUid: sender.authId,
    sentFromDisplayName: sender.displayName,
    photoURL: sender.photoURL || '',
    status: 'sent',
  };

  await iSetDoc(_setDoc, msgRef, message, undefined, screen); // ✅ 1 write
};

// export const sendMessage = async (conversationId, _sender, messageText /*, screen */) => {
//   const functions = getFunctions();
//   const fn = httpsCallable(functions, "sendMessage");
//   // your CF only needs conversationId + text; it gets uid from auth
//   await fn({ conversationId, text: messageText });
// };

export const listenToMessages = (convoId, callback, screen) => {
  const messagesRef = collection(db, 'conversations', convoId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  return iOnSnapshot(_onSnapshot, q, (snapshot) => {
    const messages = snapshot.docs.map(doc => doc.data());
    callback(messages);
  }, screen);
};

export const sendSystemMessage = (conversationId, text, screen) => {
  console.log(`📢 Sending system message to conversation ${conversationId}:`, text);
  return iAddDoc(_addDoc, collection(db, 'conversations', conversationId, 'messages'), {
    sender: 'system',
    text,
    timestamp: serverTimestamp(),
  }, screen);
};

export const markMessagesRead = async (convoId, messages, currentUserId, screen) => {
  const updates = messages
    .filter((msg) => msg.status === 'sent' && msg.sentFromUid !== currentUserId)
    .map((msg) => {
      const msgRef = doc(db, 'conversations', convoId, 'messages', msg.mid);
      return iUpdateDoc(_updateDoc, msgRef, { status: 'read' }, screen);
    });

  try {
    await Promise.all(updates);
  } catch (err) {
    console.error('❌ Error marking messages as read:', err.message);
  }
};

export const getUnreadMessageCount = async (convoId, userId) => {
  // NOTE: getCountFromServer is already billed; leave as-is
  const messagesRef = collection(db, 'conversations', convoId, 'messages');
  const q = query(
    messagesRef,
    where('sentFromUid', '!=', userId),
    where('status', '==', 'sent')
  );

  try {
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (err) {
    console.error(`❌ Error getting unread count for convo ${convoId}:`, err.message);
    return 0;
  }
};

export async function updateLastSeenIfNotSender(convoId, userId, senderId, screen) {
  if (userId === senderId) return;

  const convoRef = doc(db, 'conversations', convoId);
  try {
    await iUpdateDoc(_updateDoc, convoRef, { [`lastSeen.${userId}`]: serverTimestamp() }, screen);
  } catch (err) {
    console.error(`❌ Error updating lastSeen for ${userId}:`, err.message);
    throw err;
  }
}

/* ========== 🚨 Distress / Admin ========== */

export const sendDistressAlertEmail = async (userData, level) => {
  const { authId, displayName, email, ...rest } = userData;
  const fullUserData = { authId, displayName, email, ...rest };

  console.log("📨 Calling sendDistressEmail function...", {
    level,
    user: { displayName, email, authId },
  });

  try {
    const functions = getFunctions(app, "us-central1");
    const sendEmail = httpsCallable(functions, "sendDistressEmail");
    await sendEmail({ level, user: fullUserData });
    console.log("📧 Distress email sent successfully");
  } catch (error) {
    console.error("❌ Error sending distress email:", error);
  }
};

export const logDistressSelection = async (uid, level, screen) => {
  if (!uid || typeof level !== "number") return;

  try {
    const ref = collection(doc(db, "users", uid), "distressLog");
    await iAddDoc(_addDoc, ref, { level, timestamp: serverTimestamp() }, screen);
    console.log("📝 Distress level logged successfully.");
  } catch (error) {
    console.error("❌ Error logging distress level:", error);
  }
};

export const disableChatForUser = async (uid, screen) => {
  try {
    const userRef = doc(db, "users", uid);
    await iUpdateDoc(_updateDoc, userRef, { chatDisabled: true }, screen);
    console.log(`✅ Chat disabled for user ${uid}`);
  } catch (error) {
    console.error("❌ Failed to disable chat:", error);
    throw error;
  }
};

export const enableChatForUser = async (uid, screen) => {
  try {
    await iUpdateDoc(_updateDoc, doc(db, 'users', uid), { chatDisabled: false }, screen);
    console.log(`✅ Chat re-enabled for user ${uid}`);
  } catch (err) {
    console.error('❌ Failed to re-enable chat:', err.message);
    throw err;
  }
};

// Optional: expose the meter to dump totals from a debug button
export { meter };


