import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
// AWS_REGION is automatically provided by Lambda runtime
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Table names from environment variables
export const TABLES = {
  USERS: process.env.USERS_TABLE || 'sharepairs-dev-users',
  CONVERSATIONS: process.env.CONVERSATIONS_TABLE || 'sharepairs-dev-conversations',
  MESSAGES: process.env.MESSAGES_TABLE || 'sharepairs-dev-messages',
  USER_PROFILES: process.env.USER_PROFILES_TABLE || 'sharepairs-dev-user-profiles',
  AUDIT_LOGS: process.env.AUDIT_LOGS_TABLE || 'sharepairs-dev-audit-logs',
  FILES: process.env.FILES_TABLE || 'sharepairs-dev-files',
  DISTRESS_EVENTS: process.env.DISTRESS_EVENTS_TABLE || 'sharepairs-dev-distress-events'
};

/**
 * Get a single item from DynamoDB
 */
export async function getItem(tableName, key) {
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
  const command = new PutCommand({
    TableName: tableName,
    Item: item
  });
  await docClient.send(command);
  return item;
}

/**
 * Update an item in DynamoDB
 */
export async function updateItem(tableName, key, updates) {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    ...updates
  });
  const response = await docClient.send(command);
  return response.Attributes;
}

/**
 * Delete an item from DynamoDB
 */
export async function deleteItem(tableName, key) {
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
  const command = new ScanCommand({
    TableName: tableName,
    ...params
  });
  const response = await docClient.send(command);
  return response.Items || [];
}

