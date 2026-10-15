import { success, error } from '../../../shared/response.js';
import { authenticateUser } from '../../../shared/auth.js';
import { getItem, updateItem, scan, query, deleteItem } from '../../../shared/database.js';
import { TABLES } from '../../../shared/database.js';
import { toUserData } from '../../../shared/stubAuth.js';
import { createInvite, listInvites } from '../../../shared/invites.js';
import { listEligibleScreeners, replaceAccessCode } from '../../../shared/screeners.js';
import { config } from '../../../shared/config.js';
import { sendMatchNotificationEmail } from '../../../shared/email.js';
import { toMessageShape, flagConversationForReview } from '../../../shared/messageModeration.js';
import { appendAdminNote, parseAdminNoteText, shapeAdminNotes } from '../../../shared/adminNotes.js';
import {
  MODERATION_STATUSES,
  isSupportConversation,
  normalizeModerationStatus,
} from '../../../shared/conversationModeration.js';
import { notifyConversationUpdate, toConvoShape } from '../../../shared/conversations.js';
import { broadcastToUsers } from '../../../shared/broadcast.js';

function requireAdmin(auth) {
  if (!auth.isAdmin && !auth.is_admin) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

function contactFromUser(user, type) {
  return {
    uid: user.id,
    displayName: user.display_name || user.displayName || user.email || 'User',
    photoURL: user.photo_url || user.photoURL || '',
    type,
    residence: user.residence || '',
    lossExp: user.loss_exp || user.lossExp || '',
  };
}

function matchRefFromUser(user) {
  return {
    uid: user.id,
    displayName: user.display_name || user.displayName || user.email || 'User',
    photoURL: user.photo_url || user.photoURL || '',
  };
}

function matchUidOf(user) {
  if (!user) return null;
  const m = user.simpatico_match ?? user.simpaticoMatch;
  if (!m) return null;
  if (typeof m === 'string') return m || null;
  return m.uid || m.authId || null;
}

function stripMatchContact(contacts, otherUid) {
  return (Array.isArray(contacts) ? contacts : []).filter(
    (c) => !(c?.uid === otherUid && c?.type === 'match')
  );
}

function upsertContact(contacts, contact) {
  const list = Array.isArray(contacts) ? [...contacts] : [];
  const idx = list.findIndex((c) => c?.uid === contact.uid);
  if (idx >= 0) list[idx] = { ...list[idx], ...contact };
  else list.push(contact);
  return list;
}

/** Clear an existing match so rematching does not leave orphan partners. */
async function clearExistingMatch(user, now) {
  const otherUid = matchUidOf(user);
  if (!otherUid || !user?.id) return;
  await updateItem(TABLES.USERS, { id: user.id }, {
    simpatico_match: null,
    contacts: stripMatchContact(user.contacts, otherUid),
    updated_at: now,
  });
  const other = await getItem(TABLES.USERS, { id: otherUid });
  if (other) {
    await updateItem(TABLES.USERS, { id: otherUid }, {
      simpatico_match: null,
      contacts: stripMatchContact(other.contacts, user.id),
      updated_at: now,
    });
  }
}

/**
 * GET /api/admin/users
 */
export async function listUsers(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const all = await scan(TABLES.USERS);
    const users = all.map((u) => {
      const data = toUserData(u);
      if (!data) return null;
      return { ...data, adminNotes: shapeAdminNotes(u.admin_notes) };
    }).filter(Boolean);
    return success({ users });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * GET /api/admin/invites
 */
export async function listInvitesHandler(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const invites = await listInvites();
    return success({ invites });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/invites
 * Body optional: { }. Returns a single-use code with no participant PHI.
 */
export async function createInviteHandler(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const invite = await createInvite({ createdBy: auth.userId });
    return success({ invite }, 201);
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * GET /api/admin/screeners
 * Eligible screener rows. Creates the Share Pairs login if submit did not.
 * Includes the live access code so the study team can give it to the participant.
 */
export async function listScreenersHandler(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const screeners = await listEligibleScreeners();
    return success({ screeners });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/screeners/access-code
 * Body: { screenerId }. Replaces the password with a new access code.
 */
export async function issueScreenerAccessCode(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const screenerId = String(body.screenerId || '').trim();
    if (!screenerId) return error('screenerId required', 400);
    const result = await replaceAccessCode(screenerId);
    return success(result);
  } catch (err) {
    return error(err.message || 'Could not issue an access code', err.status || 401);
  }
}

/**
 * POST /api/admin/matches — body { uid, matchUid }
 * Sets bidirectional simpatico_match and adds match contacts.
 */
export async function createMatch(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const uid = body.uid;
    const matchUid = body.matchUid;
    if (!uid || !matchUid) return error('uid and matchUid required', 400);
    if (uid === matchUid) return error('Cannot match user to themselves', 400);

    let a = await getItem(TABLES.USERS, { id: uid });
    let b = await getItem(TABLES.USERS, { id: matchUid });
    if (!a || !b) return error('User not found', 404);

    const now = Date.now();

    // Break prior pairs first (rematch must not orphan old partners)
    const aPrev = matchUidOf(a);
    const bPrev = matchUidOf(b);
    if (aPrev && aPrev !== matchUid) await clearExistingMatch(a, now);
    if (bPrev && bPrev !== uid) {
      // reload b if clearExistingMatch above may have touched it
      b = (await getItem(TABLES.USERS, { id: matchUid })) || b;
      await clearExistingMatch(b, now);
    }
    a = (await getItem(TABLES.USERS, { id: uid })) || a;
    b = (await getItem(TABLES.USERS, { id: matchUid })) || b;

    const aContacts = upsertContact(
      stripMatchContact(a.contacts, aPrev),
      contactFromUser(b, 'match')
    );
    const bContacts = upsertContact(
      stripMatchContact(b.contacts, bPrev),
      contactFromUser(a, 'match')
    );

    await updateItem(TABLES.USERS, { id: uid }, {
      simpatico_match: matchRefFromUser(b),
      contacts: aContacts,
      has_seen_match: false,
      match_notice_seen: false,
      updated_at: now,
    });
    await updateItem(TABLES.USERS, { id: matchUid }, {
      simpatico_match: matchRefFromUser(a),
      contacts: bContacts,
      has_seen_match: false,
      match_notice_seen: false,
      updated_at: now,
    });

    // Notify both participants (best-effort; do not fail the match)
    const emails = [];
    try {
      emails.push(
        sendMatchNotificationEmail(a.email, {
          recipientName: a.display_name || a.displayName || '',
          partnerLabel: b.display_name || b.displayName || b.email || 'your match',
        })
      );
      emails.push(
        sendMatchNotificationEmail(b.email, {
          recipientName: b.display_name || b.displayName || '',
          partnerLabel: a.display_name || a.displayName || a.email || 'your match',
        })
      );
      await Promise.all(emails);
    } catch (err) {
      console.warn('[admin.createMatch] match email failed:', err?.message || err);
    }

    try {
      await broadcastToUsers([uid, matchUid], {
        type: 'matchCreated',
        payload: {
          timestamp: now,
          matches: {
            [uid]: {
              uid: b.id,
              displayName: b.display_name || b.displayName || b.email || 'your match',
              photoURL: b.photo_url || b.photoURL || '',
            },
            [matchUid]: {
              uid: a.id,
              displayName: a.display_name || a.displayName || a.email || 'your match',
              photoURL: a.photo_url || a.photoURL || '',
            },
          },
        },
      });
    } catch (err) {
      console.warn('[admin.createMatch] match notice failed:', err?.message || err);
    }

    return success({
      ok: true,
      uid,
      matchUid,
      match: {
        uid: b.id,
        displayName: b.display_name || b.email,
        photoURL: b.photo_url || '',
      },
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/matches/remove — body { uid }
 * Clears match for uid and the paired user if present.
 */
export async function removeMatch(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const uid = body.uid;
    if (!uid) return error('uid required', 400);
    const user = await getItem(TABLES.USERS, { id: uid });
    if (!user) return error('User not found', 404);

    const matchUid = matchUidOf(user);
    const now = Date.now();

    await updateItem(TABLES.USERS, { id: uid }, {
      simpatico_match: null,
      contacts: stripMatchContact(user.contacts, matchUid),
      updated_at: now,
    });

    if (matchUid) {
      const other = await getItem(TABLES.USERS, { id: matchUid });
      if (other) {
        await updateItem(TABLES.USERS, { id: matchUid }, {
          simpatico_match: null,
          contacts: stripMatchContact(other.contacts, uid),
          updated_at: now,
        });
      }
    }

    return success({ ok: true });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * GET /api/admin/distress?uid=&limit=5
 * Latest distress thermometer readings for a participant (newest first).
 * Pass limit=0 or all=1 for the full history.
 */
export async function listUserDistress(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);

    const qs = event.queryStringParameters || {};
    const uid = qs.uid;
    if (!uid) return error('uid required', 400);

    const wantAll = qs.all === '1' || qs.all === 'true' || qs.limit === '0';
    const limit = wantAll ? null : Math.min(Math.max(parseInt(qs.limit || '5', 10) || 5, 1), 100);

    let events = [];
    try {
      events = await query(TABLES.DISTRESS_EVENTS, {
        IndexName: 'user-index',
        KeyConditionExpression: 'user_id = :userId',
        ExpressionAttributeValues: { ':userId': uid },
        ScanIndexForward: false,
        ...(limit != null ? { Limit: limit } : {}),
      });
    } catch {
      // Fallback when GSI is missing (or MEMORY_DB without full query support)
      const all = await scan(TABLES.DISTRESS_EVENTS);
      events = all
        .filter((e) => e.user_id === uid || e.userId === uid)
        .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    }

    events = [...events].sort(
      (a, b) => Number(b.created_at || 0) - Number(a.created_at || 0)
    );
    if (limit != null) events = events.slice(0, limit);

    return success({
      uid,
      events: events.map((e) => ({
        id: e.id,
        score: e.score,
        message: e.message || null,
        status: e.status || null,
        notifyError: e.notify_error || e.notifyError || null,
        chatSuspended: e.chat_suspended === true,
        createdAt: e.created_at || e.createdAt || null,
      })),
      truncated: !wantAll && events.length >= (limit || 5),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/chat/enable|disable — body { uid }
 */
export async function setChatDisabled(event, disabled) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const uid = body.uid;
    if (!uid) return error('uid required', 400);
    await updateItem(TABLES.USERS, { id: uid }, {
      chat_disabled: !!disabled,
      updated_at: Date.now(),
    });
    return success({ ok: true, chatDisabled: !!disabled });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

export async function enableChat(event) {
  return setChatDisabled(event, false);
}

export async function disableChat(event) {
  return setChatDisabled(event, true);
}

/**
 * DELETE /api/admin/users/:uid
 * Hard-delete a user for testing so the same email can register again.
 * Also clears partner match/contacts and related conversations/messages/distress.
 */
export async function deleteUser(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);

    const uid = event.pathParameters?.uid;
    if (!uid) return error('uid required', 400);
    if (uid === auth.userId) {
      return error('Cannot delete your own account while signed in', 400);
    }
    if (uid === config.supportUid) {
      return error('Cannot delete the Study Support account', 400);
    }

    const user = await getItem(TABLES.USERS, { id: uid });
    if (!user) return error('User not found', 404);

    const now = Date.now();
    await clearExistingMatch(user, now);

    // Strip this uid from every other user's contacts list
    try {
      const allUsers = await scan(TABLES.USERS);
      for (const other of allUsers) {
        if (!other?.id || other.id === uid || other.type === 'invite') continue;
        const contacts = Array.isArray(other.contacts) ? other.contacts : [];
        const next = contacts.filter((c) => c?.uid !== uid);
        if (next.length !== contacts.length) {
          await updateItem(TABLES.USERS, { id: other.id }, {
            contacts: next,
            updated_at: now,
          });
        }
      }
    } catch (err) {
      console.warn('[admin.deleteUser] contact cleanup failed:', err?.message || err);
    }

    // Conversations + messages involving this user
    try {
      const convos = await scan(TABLES.CONVERSATIONS);
      const mine = convos.filter((c) => {
        const users = c.users || [];
        return users.includes(uid) || c.requester === uid || c.recipient === uid;
      });
      for (const convo of mine) {
        const cid = convo.id;
        try {
          const msgs = await query(TABLES.MESSAGES, {
            KeyConditionExpression: 'conversation_id = :cid',
            ExpressionAttributeValues: { ':cid': cid },
          });
          for (const m of msgs) {
            await deleteItem(TABLES.MESSAGES, {
              conversation_id: m.conversation_id || cid,
              message_id: m.message_id,
            });
          }
        } catch (err) {
          // Fallback scan for memory / missing keys
          try {
            const allMsgs = await scan(TABLES.MESSAGES);
            for (const m of allMsgs) {
              if ((m.conversation_id || m.conversationId) === cid) {
                await deleteItem(TABLES.MESSAGES, {
                  conversation_id: m.conversation_id || cid,
                  message_id: m.message_id || m.messageId,
                });
              }
            }
          } catch (e2) {
            console.warn('[admin.deleteUser] message cleanup failed:', e2?.message || e2);
          }
        }
        await deleteItem(TABLES.CONVERSATIONS, { id: cid });
      }
    } catch (err) {
      console.warn('[admin.deleteUser] conversation cleanup failed:', err?.message || err);
    }

    // Distress events
    try {
      let events = [];
      try {
        events = await query(TABLES.DISTRESS_EVENTS, {
          IndexName: 'user-index',
          KeyConditionExpression: 'user_id = :userId',
          ExpressionAttributeValues: { ':userId': uid },
        });
      } catch {
        const all = await scan(TABLES.DISTRESS_EVENTS);
        events = all.filter((e) => e.user_id === uid || e.userId === uid);
      }
      for (const e of events) {
        if (e?.id) await deleteItem(TABLES.DISTRESS_EVENTS, { id: e.id });
      }
    } catch (err) {
      console.warn('[admin.deleteUser] distress cleanup failed:', err?.message || err);
    }

    await deleteItem(TABLES.USERS, { id: uid });

    return success({
      ok: true,
      uid,
      email: user.email || null,
      message: 'User deleted. Email can be used to register again.',
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * GET /api/admin/conversations — list all (scan; fine for small study)
 */
export async function listAllConversations(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    const all = await scan(TABLES.CONVERSATIONS);
    return success({
      conversations: all.map((row) => toConvoShape(row, { includeAdminNotes: true })).filter(Boolean),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

async function deleteConversationMessages(conversationId) {
  const cid = String(conversationId);
  try {
    const msgs = await query(TABLES.MESSAGES, {
      KeyConditionExpression: 'conversation_id = :cid',
      ExpressionAttributeValues: { ':cid': cid },
    });
    for (const m of msgs) {
      await deleteItem(TABLES.MESSAGES, {
        conversation_id: m.conversation_id || cid,
        message_id: m.message_id,
      });
    }
  } catch (err) {
    const allMsgs = await scan(TABLES.MESSAGES);
    for (const m of allMsgs) {
      if ((m.conversation_id || m.conversationId) === cid) {
        await deleteItem(TABLES.MESSAGES, {
          conversation_id: m.conversation_id || cid,
          message_id: m.message_id || m.messageId,
        });
      }
    }
  }
}

/**
 * POST /api/admin/conversations/delete
 * Body: { conversationId }
 * Removes the conversation and its messages. Does not unmatch the participants.
 */
export async function deleteConversation(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const conversationId = body.conversationId || body.docID;
    if (!conversationId) return error('conversationId required', 400);

    const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
    if (!convo) return error('Conversation not found', 404);

    await deleteConversationMessages(conversationId);
    await deleteItem(TABLES.CONVERSATIONS, { id: conversationId });

    const users = convo.users || [];
    try {
      await broadcastToUsers(users, {
        type: 'conversationDeleted',
        payload: { conversationId, timestamp: Date.now() },
      });
    } catch (err) {
      console.warn('[admin.deleteConversation] notify failed:', err?.message || err);
    }

    return success({ ok: true, conversationId });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/conversations/moderation
 * Body: { conversationId, status: 'active' | 'paused' | 'terminated' }
 * Pause or terminate a match conversation without removing the Simpatico Match.
 */
export async function setConversationModeration(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const conversationId = body.conversationId || body.docID;
    const status = String(body.status || '').trim();
    if (!conversationId) return error('conversationId required', 400);
    if (!MODERATION_STATUSES.includes(status)) {
      return error("status must be 'active', 'paused', or 'terminated'", 400);
    }

    const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
    if (!convo) return error('Conversation not found', 404);
    if (isSupportConversation(convo, config.supportUid)) {
      return error('Cannot pause or terminate a Study Support conversation', 400);
    }

    const now = Date.now();
    await updateItem(TABLES.CONVERSATIONS, { id: conversationId }, {
      moderation_status: status,
      is_closed: status === 'terminated',
      updated_at: now,
    });
    const updated = await getItem(TABLES.CONVERSATIONS, { id: conversationId });

    try {
      await notifyConversationUpdate(updated.users || convo.users || [], updated);
    } catch (err) {
      console.warn('[admin.setConversationModeration] notify failed:', err?.message || err);
    }

    return success({
      ok: true,
      conversationId,
      moderationStatus: normalizeModerationStatus(updated),
      isClosed: Boolean(updated?.is_closed),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/conversations/monitor
 * Body: { conversationId, pinned?, needsReview?, highPriority? }
 */
export async function setConversationMonitor(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const conversationId = body.conversationId || body.docID;
    if (!conversationId) return error('conversationId required', 400);
    const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
    if (!convo) return error('Conversation not found', 404);

    const updates = { updated_at: Date.now() };
    if (body.pinned !== undefined) updates.pinned = Boolean(body.pinned);
    if (body.needsReview !== undefined) updates.needs_review = Boolean(body.needsReview);
    if (body.highPriority !== undefined) updates.high_priority = Boolean(body.highPriority);
    if (Object.keys(updates).length === 1) {
      return success({ ok: true, conversation: toConvoShape(convo, { includeAdminNotes: true }) });
    }

    const becameHighReview =
      (updates.needs_review === true && !convo.needs_review) ||
      (updates.high_priority === true && !convo.high_priority);

    await updateItem(TABLES.CONVERSATIONS, { id: conversationId }, updates);
    const updated = await getItem(TABLES.CONVERSATIONS, { id: conversationId });

    try {
      await notifyConversationUpdate(updated.users || convo.users || [], updated);
    } catch (err) {
      console.warn('[admin.setConversationMonitor] notify failed:', err?.message || err);
    }

    if (becameHighReview && (updated.needs_review || updated.high_priority)) {
      try {
        await flagConversationForReview(updated, {
          highPriority: Boolean(updated.high_priority),
          reason: 'admin_flag',
          reporterLabel: auth.displayName || auth.email || 'admin',
          incrementReport: false,
        });
      } catch (err) {
        console.warn('[admin.setConversationMonitor] email failed:', err?.message || err);
      }
    }

    return success({ ok: true, conversation: toConvoShape(updated, { includeAdminNotes: true }) });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/conversations/assign
 * Body: { conversationId, uid } — uid empty/null clears the assignment.
 * Assignee must be an admin. Never broadcast to participants.
 */
export async function assignConversation(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const conversationId = body.conversationId || body.docID;
    if (!conversationId) return error('conversationId required', 400);
    const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
    if (!convo) return error('Conversation not found', 404);

    const rawUid = body.uid === undefined ? body.assignedToUid : body.uid;
    const assigneeUid = rawUid == null || rawUid === '' ? null : String(rawUid);
    const now = Date.now();
    const actorName = auth.displayName || auth.userData?.displayName || auth.email || 'Admin';

    let updates;
    if (!assigneeUid) {
      updates = {
        assigned_to_uid: null,
        assigned_to_name: null,
        assigned_at: null,
        assigned_by_uid: null,
        assigned_by_name: null,
        updated_at: now,
      };
    } else {
      const assignee = await getItem(TABLES.USERS, { id: assigneeUid });
      if (!assignee) return error('User not found', 404);
      if (!assignee.is_admin && !assignee.admin) {
        return error('Conversations can only be assigned to an admin or RA', 400);
      }
      updates = {
        assigned_to_uid: assignee.id,
        assigned_to_name: assignee.display_name || assignee.displayName || assignee.email || assignee.id,
        assigned_at: now,
        assigned_by_uid: auth.userId,
        assigned_by_name: actorName,
        updated_at: now,
      };
    }

    await updateItem(TABLES.CONVERSATIONS, { id: conversationId }, updates);
    const updated = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
    return success({
      ok: true,
      conversation: toConvoShape(updated, { includeAdminNotes: true }),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/messages/notes
 * Body: { conversationId, messageId, body }
 */
export async function addMessageNote(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const conversationId = body.conversationId;
    const messageId = body.messageId || body.mid;
    if (!conversationId || !messageId) return error('conversationId and messageId required', 400);
    let text;
    try {
      text = parseAdminNoteText(body.body || body.note);
    } catch (err) {
      return error(err.message, err.status || 400);
    }

    const msg = await getItem(TABLES.MESSAGES, {
      conversation_id: conversationId,
      message_id: messageId,
    });
    if (!msg) return error('Message not found', 404);

    const notes = appendAdminNote(msg.admin_notes, {
      authorUid: auth.userId,
      authorName: auth.displayName || auth.userData?.displayName || auth.email || 'Admin',
      body: text,
    });
    await updateItem(
      TABLES.MESSAGES,
      { conversation_id: conversationId, message_id: messageId },
      { admin_notes: notes, updated_at: Date.now() }
    );
    return success({
      ok: true,
      message: toMessageShape({ ...msg, admin_notes: notes }, { isAdmin: true, viewerUid: auth.userId }),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/conversations/notes
 * Body: { conversationId, body }
 */
export async function addConversationNote(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const conversationId = body.conversationId || body.docID;
    if (!conversationId) return error('conversationId required', 400);
    let text;
    try {
      text = parseAdminNoteText(body.body || body.note);
    } catch (err) {
      return error(err.message, err.status || 400);
    }

    const convo = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
    if (!convo) return error('Conversation not found', 404);

    const notes = appendAdminNote(convo.admin_notes, {
      authorUid: auth.userId,
      authorName: auth.displayName || auth.userData?.displayName || auth.email || 'Admin',
      body: text,
    });
    await updateItem(TABLES.CONVERSATIONS, { id: conversationId }, {
      admin_notes: notes,
      updated_at: Date.now(),
    });
    const updated = await getItem(TABLES.CONVERSATIONS, { id: conversationId });
    return success({
      ok: true,
      conversation: toConvoShape(updated, { includeAdminNotes: true }),
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}

/**
 * POST /api/admin/users/notes
 * Body: { uid, body }
 */
export async function addUserNote(event) {
  try {
    const auth = await authenticateUser(event);
    requireAdmin(auth);
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Invalid JSON', 400);
    }
    const uid = body.uid;
    if (!uid) return error('uid required', 400);
    let text;
    try {
      text = parseAdminNoteText(body.body || body.note);
    } catch (err) {
      return error(err.message, err.status || 400);
    }

    const user = await getItem(TABLES.USERS, { id: uid });
    if (!user) return error('User not found', 404);

    const notes = appendAdminNote(user.admin_notes, {
      authorUid: auth.userId,
      authorName: auth.displayName || auth.userData?.displayName || auth.email || 'Admin',
      body: text,
    });
    await updateItem(TABLES.USERS, { id: uid }, {
      admin_notes: notes,
      updated_at: Date.now(),
    });
    const updated = await getItem(TABLES.USERS, { id: uid });
    const data = toUserData(updated);
    return success({
      ok: true,
      user: { ...data, adminNotes: shapeAdminNotes(updated.admin_notes) },
    });
  } catch (err) {
    return error(err.message || 'Unauthorized', err.status || 401);
  }
}
