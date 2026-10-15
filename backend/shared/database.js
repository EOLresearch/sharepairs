import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as memory from './memoryDb.js';

const useMemory = process.env.MEMORY_DB === 'true';

// Initialize DynamoDB client (unused when MEMORY_DB=true)
const client = useMemory
  ? null
  : new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.DYNAMODB_ENDPOINT
        ? { endpoint: process.env.DYNAMODB_ENDPOINT }
        : {}),
    });
const docClient = useMemory ? null : DynamoDBDocumentClient.from(client);

// Table names from environment variables
export const TABLES = {
  USERS: process.env.USERS_TABLE || 'sharepairs-dev-users',
  CONVERSATIONS: process.env.CONVERSATIONS_TABLE || 'sharepairs-dev-conversations',
  MESSAGES: process.env.MESSAGES_TABLE || 'sharepairs-dev-messages',
  USER_PROFILES: process.env.USER_PROFILES_TABLE || 'sharepairs-dev-user-profiles',
  AUDIT_LOGS: process.env.AUDIT_LOGS_TABLE || 'sharepairs-dev-audit-logs',
  FILES: process.env.FILES_TABLE || 'sharepairs-dev-files',
  DISTRESS_EVENTS: process.env.DISTRESS_EVENTS_TABLE || 'sharepairs-dev-distress-events',
  CONNECTIONS: process.env.CONNECTIONS_TABLE || 'sharepairs-dev-connections',
  PROMPTS: process.env.PROMPTS_TABLE || 'sharepairs-dev-prompts',
  ASSESSMENTS: process.env.ASSESSMENTS_TABLE || 'sharepairs-dev-assessments',
  SCREENERS: process.env.SCREENERS_TABLE || 'sharepairs-dev-screeners',
};

/**
 * Get a single item from DynamoDB
 */
export async function getItem(tableName, key) {
  if (useMemory) return memory.memoryGetItem(tableName, key);
  const command = new GetCommand({
    TableName: tableName,
    Key: key
  });
  const response = await docClient.send(command);
  return response.Item || null;
}

/**
 * Put an item into DynamoDB
 */
export async function putItem(tableName, item) {
  if (useMemory) return memory.memoryPutItem(tableName, item);
  const command = new PutCommand({
    TableName: tableName,
    Item: item
  });
  await docClient.send(command);
  return item;
}

/**
 * Update an item in DynamoDB (replace attributes by key).
 * updates: plain object of attribute names to values.
 * Pass `null` to REMOVE an attribute.
 */
export async function updateItem(tableName, key, updates, options = {}) {
  if (useMemory) {
    if (typeof options.condition === 'function') {
      const existing = await memory.memoryGetItem(tableName, key);
      if (!options.condition(existing)) {
        const err = new Error('The conditional request failed');
        err.name = 'ConditionalCheckFailedException';
        throw err;
      }
    }
    return memory.memoryUpdateItem(tableName, key, updates);
  }
  const names = { ...(options.extraNames || {}) };
  const values = { ...(options.extraValues || {}) };
  const setParts = [];
  const removeParts = [];
  let i = 0;
  for (const [k, v] of Object.entries(updates)) {
    const n = `#a${i}`;
    names[n] = k;
    if (v === null || v === undefined) {
      removeParts.push(n);
    } else {
      const vn = `:v${i}`;
      values[vn] = v;
      setParts.push(`${n} = ${vn}`);
    }
    i++;
  }
  if (setParts.length === 0 && removeParts.length === 0) {
    return (await getItem(tableName, key)) || null;
  }
  const expr = [];
  if (setParts.length) expr.push('SET ' + setParts.join(', '));
  if (removeParts.length) expr.push('REMOVE ' + removeParts.join(', '));
  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: expr.join(' '),
    ExpressionAttributeNames: names,
    ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
    ReturnValues: 'ALL_NEW',
    ...(options.conditionExpression ? { ConditionExpression: options.conditionExpression } : {}),
  });
  const response = await docClient.send(command);
  return response.Attributes;
}

/**
 * Atomically increment numeric attributes (DynamoDB ADD).
 * increments: { fieldName: numberDelta, ... }
 */
export async function incrementAttrs(tableName, key, increments) {
  if (useMemory) return memory.memoryIncrementAttrs(tableName, key, increments);
  const names = {};
  const values = {};
  const parts = [];
  let i = 0;
  for (const [attr, delta] of Object.entries(increments || {})) {
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) continue;
    const nk = `#a${i}`;
    const vk = `:v${i}`;
    names[nk] = attr;
    values[vk] = n;
    parts.push(`${nk} ${vk}`);
    i += 1;
  }
  if (parts.length === 0) {
    return (await getItem(tableName, key)) || null;
  }
  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: `ADD ${parts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  });
  const response = await docClient.send(command);
  return response.Attributes;
}

/**
 * Delete an item from DynamoDB
 */
export async function deleteItem(tableName, key) {
  if (useMemory) return memory.memoryDeleteItem(tableName, key);
  const command = new DeleteCommand({
    TableName: tableName,
    Key: key
  });
  await docClient.send(command);
}

/**
 * Query DynamoDB table
 */
export async function query(tableName, params) {
  if (useMemory) return memory.memoryQuery(tableName, params);
  const command = new QueryCommand({
    TableName: tableName,
    ...params
  });
  const response = await docClient.send(command);
  return response.Items || [];
}

/**
 * Scan DynamoDB table
 */
export async function scan(tableName, params = {}) {
  if (useMemory) return memory.memoryScan(tableName, params);
  const command = new ScanCommand({
    TableName: tableName,
    ...params
  });
  const response = await docClient.send(command);
  return response.Items || [];
}
