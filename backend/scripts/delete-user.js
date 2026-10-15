#!/usr/bin/env node
/**
 * Delete a user by email from DynamoDB (study ops / re-test signup).
 *
 * Usage:
 *   USERS_TABLE=sharepairs-dev-users node backend/scripts/delete-user.js you@example.com
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const email = String(process.argv[2] || '').toLowerCase().trim();
if (!email) {
  console.error('Usage: node backend/scripts/delete-user.js <email>');
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
    return res.Items || [];
  } catch {
    const res = await client.send(new ScanCommand({ TableName: table }));
    return (res.Items || []).filter((u) => (u.email || '').toLowerCase() === norm);
  }
}

const matches = await findByEmail(email);
if (!matches.length) {
  console.error('No user found for:', email);
  process.exit(1);
}

for (const user of matches) {
  await client.send(
    new DeleteCommand({
      TableName: table,
      Key: { id: user.id },
    })
  );
  console.log('Deleted:', email, '(id:', user.id + ')');
}
