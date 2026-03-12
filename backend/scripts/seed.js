#!/usr/bin/env node
/**
 * Local/dev seed script. Creates tables if missing and inserts test users + conversations.
 * Usage: STAGE=dev node scripts/seed.js
 * Requires: AWS credentials (or DynamoDB Local), USERS_TABLE, CONVERSATIONS_TABLE, MESSAGES_TABLE in env.
 */
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const stage = process.env.STAGE || 'dev';
const prefix = `sharepairs-${stage}`;
const tables = {
  users: `${prefix}-users`,
  conversations: `${prefix}-conversations`,
  messages: `${prefix}-messages`,
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
      created_at: now,
      updated_at: now,
    },
    {
      id: 'user-dev-2',
      email: 'user2@example.com',
      password: 'password123',
      display_name: 'Test User 2',
      is_admin: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: SUPPORT_UID,
      email: 'support@example.com',
      password: 'support',
      display_name: 'Study Support',
      is_admin: true,
      created_at: now,
      updated_at: now,
    },
  ];

  for (const u of testUsers) {
    await doc.send(
      new PutCommand({
        TableName: tables.users,
        Item: { ...u, email: (u.email || '').toLowerCase() },
      })
    );
  }
  console.log('Seeded', testUsers.length, 'users');
}

async function main() {
  console.log('Seed stage:', stage);
  await createUsersTable();
  await createConversationsTable();
  await createMessagesTable();
  await seedUsers();
  console.log('Done. Login with user1@example.com / password123 (stub auth).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
