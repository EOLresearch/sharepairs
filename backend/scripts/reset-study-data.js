#!/usr/bin/env node
/**
 * Wipe study DynamoDB activity before volunteer handoff.
 *
 * Keeps:
 *   - Study Support user (SUPPORT_UID)
 *   - Any emails in KEEP_EMAILS (comma-separated)
 *   - Prompt bank (unchanged unless RESET_PROMPTS=1)
 *
 * Deletes:
 *   - All other users
 *   - All conversations + messages
 *   - Distress events + websocket connections (orphans from deleted users)
 *
 * Resets kept users' match/contacts so handoff starts clean.
 *
 * Usage (CloudShell, study account):
 *   CONFIRM=YES KEEP_EMAILS=holly@…,eolstudysupport@… node backend/scripts/reset-study-data.js
 *   CONFIRM=YES DRY_RUN=1 node backend/scripts/reset-study-data.js
 */
import { scan, deleteItem, updateItem, putItem, TABLES } from '../shared/database.js';
import { ensureSupportUser } from '../shared/supportUser.js';
import { config } from '../shared/config.js';

const CONFIRM = String(process.env.CONFIRM || '').toUpperCase() === 'YES';
const DRY_RUN = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN || '').toLowerCase());
const RESET_PROMPTS = ['1', 'true', 'yes'].includes(
  String(process.env.RESET_PROMPTS || '').toLowerCase()
);

const keepEmails = new Set(
  String(process.env.KEEP_EMAILS || process.env.SUPPORT_EMAIL || 'eolstudysupport@med.cornell.edu')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean)
);

const supportUid = config.supportUid;

function itemKey(table, item) {
  if (table === TABLES.MESSAGES) {
    return {
      conversation_id: item.conversation_id || item.conversationId,
      message_id: item.message_id || item.messageId,
    };
  }
  if (table === TABLES.CONNECTIONS) {
    return { connection_id: item.connection_id || item.connectionId };
  }
  return { id: item.id };
}

async function wipeTable(table, label) {
  const rows = await scan(table);
  console.log(`  ${label}: ${rows.length} row(s)`);
  if (DRY_RUN) return rows.length;
  let n = 0;
  for (const row of rows) {
    const key = itemKey(table, row);
    if (Object.values(key).some((v) => v == null || v === '')) {
      console.warn(`    skip (missing key):`, row);
      continue;
    }
    await deleteItem(table, key);
    n += 1;
  }
  return n;
}

async function main() {
  console.log('Study DB reset');
  console.log('  USERS_TABLE:', TABLES.USERS);
  console.log('  KEEP emails:', [...keepEmails].join(', ') || '(none)');
  console.log('  SUPPORT_UID:', supportUid);
  console.log('  DRY_RUN:', DRY_RUN);
  console.log('');

  if (!CONFIRM && !DRY_RUN) {
    console.error('Refusing to run without CONFIRM=YES (or DRY_RUN=1).');
    process.exit(1);
  }

  const users = await scan(TABLES.USERS);
  const keep = [];
  const remove = [];
  for (const u of users) {
    const email = String(u.email || '').toLowerCase().trim();
    if (u.id === supportUid || keepEmails.has(email)) keep.push(u);
    else remove.push(u);
  }

  console.log(`Users: ${users.length} total, keep ${keep.length}, delete ${remove.length}`);
  for (const u of keep) {
    console.log(`  KEEP  ${u.email || '(no email)'}  (${u.id})`);
  }
  for (const u of remove) {
    console.log(`  DEL   ${u.email || '(no email)'}  (${u.id})`);
  }
  console.log('');

  console.log('Wiping messages / conversations / distress / connections…');
  await wipeTable(TABLES.MESSAGES, 'messages');
  await wipeTable(TABLES.CONVERSATIONS, 'conversations');
  await wipeTable(TABLES.DISTRESS_EVENTS, 'distress');
  try {
    await wipeTable(TABLES.ASSESSMENTS, 'assessments');
  } catch (err) {
    console.warn('  assessments wipe skipped:', err?.message || err);
  }
  try {
    await wipeTable(TABLES.CONNECTIONS, 'connections');
  } catch (err) {
    console.warn('  connections wipe skipped:', err?.message || err);
  }

  console.log('');
  console.log('Deleting non-kept users…');
  for (const u of remove) {
    if (!u?.id) continue;
    if (DRY_RUN) continue;
    await deleteItem(TABLES.USERS, { id: u.id });
  }
  console.log(`  deleted ${remove.length}`);

  console.log('');
  console.log('Resetting kept users (clear matches / contacts)…');
  const now = Date.now();
  for (const u of keep) {
    if (!u?.id || DRY_RUN) continue;
    if (u.id === supportUid) continue; // ensureSupportUser rewrites Support cleanly
    await updateItem(TABLES.USERS, { id: u.id }, {
      partner_uid: null,
      matched_at: null,
      match_status: null,
      contacts: [],
      has_seen_match: false,
      chat_disabled: false,
      updated_at: now,
    });
    console.log(`  reset ${u.email || u.id}`);
  }

  if (RESET_PROMPTS) {
    console.log('');
    console.log('Resetting prompt analytics…');
    const prompts = await scan(TABLES.PROMPTS);
    console.log(`  prompts: ${prompts.length}`);
    for (const p of prompts) {
      if (!p?.id || DRY_RUN) continue;
      await putItem(TABLES.PROMPTS, {
        ...p,
        impressions: 0,
        clicks: 0,
        sends: 0,
        updated_at: now,
      });
    }
  } else {
    console.log('');
    console.log('Leaving prompt bank as-is (set RESET_PROMPTS=1 to zero counters).');
  }

  if (!DRY_RUN) {
    console.log('');
    console.log('Ensuring Study Support user…');
    const support = await ensureSupportUser();
    // Drop any leftover contact UIDs from wiped users
    await updateItem(TABLES.USERS, { id: support.id }, {
      contacts: [],
      partner_uid: null,
      matched_at: null,
      match_status: null,
      has_seen_match: true,
      updated_at: Date.now(),
    });
    console.log(`  ready: ${support.email} (${support.id})`);
  }

  console.log('');
  console.log(DRY_RUN ? 'Dry run complete — no changes written.' : 'Reset complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
