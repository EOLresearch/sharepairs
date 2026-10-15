#!/usr/bin/env node
/**
 * Promote a user to admin by email (study ops).
 * Usage:
 *   USERS_TABLE=sharepairs-dev-users node backend/scripts/promote-admin.js you@example.com
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const email = String(process.argv[2] || '').toLowerCase().trim();
if (!email) {
  console.error('Usage: node backend/scripts/promote-admin.js <email>');
  process.exit(1);
}

const table = process.env.USERS_TABLE || 'sharepairs-dev-users';
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);

async function findByEmail(norm) {
  try {
    const res = await client.send(
      new QueryCommand({
        TableName: table,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': norm },
      })
    );
    return res.Items?.[0] || null;
  } catch {
    const res = await client.send(new ScanCommand({ TableName: table }));
    return (res.Items || []).find((u) => (u.email || '').toLowerCase() === norm) || null;
  }
}

const user = await findByEmail(email);
if (!user) {
  console.error('User not found:', email);
  process.exit(1);
}

await client.send(
  new UpdateCommand({
    TableName: table,
    Key: { id: user.id },
    UpdateExpression: 'SET is_admin = :t, updated_at = :now',
    ExpressionAttributeValues: { ':t': true, ':now': Date.now() },
  })
);

console.log('Promoted to admin:', email, '(id:', user.id + ')');
