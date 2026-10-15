#!/usr/bin/env node
/**
 * Local/dev seed script. Creates tables if missing and inserts test users + default prompts.
 * Usage: STAGE=dev node scripts/seed.js
 * Requires: AWS credentials (or DynamoDB Local), table env vars optional (defaults to sharepairs-{stage}-*).
 */
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { DEFAULT_PROMPTS, promptDedupeKey } from '../shared/defaultPrompts.js';

const stage = process.env.STAGE || 'dev';
const prefix = `sharepairs-${stage}`;
const tables = {
  users: `${prefix}-users`,
  conversations: `${prefix}-conversations`,
  messages: `${prefix}-messages`,
  prompts: `${prefix}-prompts`,
};

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const doc = DynamoDBDocumentClient.from(client);

async function tableExists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    return false;
  }
}

async function createUsersTable() {
  const name = tables.users;
  if (await tableExists(name)) {
    console.log('Table exists:', name);
    return;
  }
  await client.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'email-index',
          KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log('Created:', name);
}

async function createConversationsTable() {
  const name = tables.conversations;
  if (await tableExists(name)) {
    console.log('Table exists:', name);
    return;
  }
  await client.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log('Created:', name);
}

async function createMessagesTable() {
  const name = tables.messages;
  if (await tableExists(name)) {
    console.log('Table exists:', name);
    return;
  }
  await client.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [
        { AttributeName: 'conversation_id', AttributeType: 'S' },
        { AttributeName: 'message_id', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'conversation_id', KeyType: 'HASH' },
        { AttributeName: 'message_id', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log('Created:', name);
}

async function waitForTable(name) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await client.send(new DescribeTableCommand({ TableName: name }));
      if (res.Table?.TableStatus === 'ACTIVE') return;
    } catch {
      // still creating
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Table ${name} did not become ACTIVE in time`);
}

async function createPromptsTable() {
  const name = tables.prompts;
  if (await tableExists(name)) {
    console.log('Table exists:', name);
    await waitForTable(name);
    return;
  }
  await client.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
  console.log('Created:', name);
  await waitForTable(name);
}

const SUPPORT_UID = 'ULvXTMmTbmTJ9q0Z3EKyr5fx0qr1';

async function seedUsers() {
  const now = Date.now();
  const testUsers = [
    {
      id: 'user-dev-1',
      email: 'user1@example.com',
      password: 'password123',
      display_name: 'Test User 1',
      is_admin: false,
      email_verified: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'user-dev-2',
      email: 'user2@example.com',
      password: 'password123',
      display_name: 'Test User 2',
      is_admin: false,
      email_verified: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: SUPPORT_UID,
      email: 'eolstudysupport@med.cornell.edu',
      password: 'password123',
      display_name: 'Study Support',
      is_admin: true,
      is_support: true,
      email_verified: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'user-admin-1',
      email: 'admin@example.com',
      password: 'password123',
      display_name: 'Admin',
      is_admin: true,
      email_verified: true,
      created_at: now,
      updated_at: now,
    },
  ];

  for (const u of testUsers) {
    const email = (u.email || '').toLowerCase();
    // Merge auth fields onto any existing row so re-seed does not wipe matches/profile.
    const existing = await doc.send(
      new GetCommand({ TableName: tables.users, Key: { id: u.id } })
    );
    const prev = existing.Item || {};
    await doc.send(
      new PutCommand({
        TableName: tables.users,
        Item: {
          ...prev,
          ...u,
          email,
          created_at: prev.created_at || u.created_at,
          updated_at: now,
        },
      })
    );
  }
  console.log('Seeded', testUsers.length, 'users (DynamoDB, merge)');
}

/** Ensure local pair user1 ↔ user2 for chat testing. */
async function ensureDevMatch() {
  const aId = 'user-dev-1';
  const bId = 'user-dev-2';
  const [aRes, bRes] = await Promise.all([
    doc.send(new GetCommand({ TableName: tables.users, Key: { id: aId } })),
    doc.send(new GetCommand({ TableName: tables.users, Key: { id: bId } })),
  ]);
  const a = aRes.Item;
  const b = bRes.Item;
  if (!a || !b) {
    console.log('Skip match seed: users missing');
    return;
  }

  const matchUid = (user) => {
    const m = user.simpatico_match ?? user.simpaticoMatch;
    if (!m) return null;
    if (typeof m === 'string') return m || null;
    return m.uid || m.authId || null;
  };

  if (matchUid(a) === bId && matchUid(b) === aId) {
    console.log('Dev match already set: user-dev-1 ↔ user-dev-2');
    return;
  }

  const now = Date.now();
  const contactFrom = (user) => ({
    uid: user.id,
    displayName: user.display_name || user.email || 'User',
    photoURL: user.photo_url || '',
    type: 'match',
    residence: user.residence || '',
    lossExp: user.loss_exp || '',
  });
  const matchRef = (user) => ({
    uid: user.id,
    displayName: user.display_name || user.email || 'User',
    photoURL: user.photo_url || '',
  });
  const upsertContact = (contacts, contact) => {
    const list = Array.isArray(contacts) ? [...contacts] : [];
    const idx = list.findIndex((c) => c?.uid === contact.uid);
    if (idx >= 0) list[idx] = { ...list[idx], ...contact };
    else list.push(contact);
    return list;
  };

  await doc.send(
    new UpdateCommand({
      TableName: tables.users,
      Key: { id: aId },
      UpdateExpression: 'SET simpatico_match = :m, contacts = :c, has_seen_match = :h, updated_at = :u',
      ExpressionAttributeValues: {
        ':m': matchRef(b),
        ':c': upsertContact(a.contacts, contactFrom(b)),
        ':h': false,
        ':u': now,
      },
    })
  );
  await doc.send(
    new UpdateCommand({
      TableName: tables.users,
      Key: { id: bId },
      UpdateExpression: 'SET simpatico_match = :m, contacts = :c, has_seen_match = :h, updated_at = :u',
      ExpressionAttributeValues: {
        ':m': matchRef(a),
        ':c': upsertContact(b.contacts, contactFrom(a)),
        ':h': false,
        ':u': now,
      },
    })
  );
  console.log('Restored dev match: user-dev-1 ↔ user-dev-2');
}

/** Default bank — only inserted when the prompts table is empty (shared with API seed). */
async function seedPrompts() {
  const existing = await doc.send(new ScanCommand({ TableName: tables.prompts, Limit: 1 }));
  if ((existing.Items || []).length > 0) {
    console.log('Prompts table already has data — skipping default seed');
    return;
  }

  const now = Date.now();
  const seen = new Set();
  let inserted = 0;
  for (const p of DEFAULT_PROMPTS) {
    const key = promptDedupeKey(p.mode, p.text);
    if (seen.has(key)) continue;
    seen.add(key);
    await doc.send(
      new PutCommand({
        TableName: tables.prompts,
        Item: {
          id: crypto.randomUUID(),
          text: p.text,
          mode: p.mode,
          category: p.category,
          active: true,
          sort_order: p.sort_order,
          impressions: 0,
          clicks: 0,
          sends: 0,
          created_at: now,
          updated_at: now,
        },
      })
    );
    inserted += 1;
  }
  console.log('Seeded', inserted, 'default prompts');
}

async function main() {
  console.log('Seed stage:', stage);
  await createUsersTable();
  await createConversationsTable();
  await createMessagesTable();
  await createPromptsTable();
  await seedUsers();
  await ensureDevMatch();
  await seedPrompts();
  console.log('Done. Login with user1@example.com / password123 (stub auth).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
