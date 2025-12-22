/**
 * DynamoDB utility for Lambda functions
 * Provides helper functions for common DynamoDB operations
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Create DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Table names
const TABLES = {
  users: process.env.USERS_TABLE || 'sharepairs-dev-users',
  conversations: process.env.CONVERSATIONS_TABLE || 'sharepairs-dev-conversations',
  messages: process.env.MESSAGES_TABLE || 'sharepairs-dev-messages',
  userProfiles: process.env.USER_PROFILES_TABLE || 'sharepairs-dev-user-profiles',
  auditLogs: process.env.AUDIT_LOGS_TABLE || 'sharepairs-dev-audit-logs'
};

/**
 * Get item by primary key
 */
const getItem = async (tableName, key) => {
  try {
    const command = new GetCommand({
      TableName: tableName,
      Key: key
    });
    const result = await docClient.send(command);
    return result.Item || null;
  } catch (error) {
    console.error('DynamoDB getItem error:', error);
    throw error;
  }
};

/**
 * Put item (create or replace)
 */
const putItem = async (tableName, item) => {
  try {
    const command = new PutCommand({
      TableName: tableName,
      Item: item
    });
    await docClient.send(command);
    return item;
  } catch (error) {
    console.error('DynamoDB putItem error:', error);
    throw error;
  }
};

/**
 * Update item (partial update)
 */
const updateItem = async (tableName, key, updates) => {
  try {
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    let attrCount = 0;

    for (const [field, value] of Object.entries(updates)) {
      const attrName = `#attr${attrCount}`;
      const attrValue = `:val${attrCount}`;
      
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = field;
      expressionAttributeValues[attrValue] = value;
      attrCount++;
    }

    // Add updated_at timestamp
    updateExpressions.push(`#updatedAt = :updatedAt`);
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = Date.now();

    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const result = await docClient.send(command);
    return result.Attributes;
  } catch (error) {
    console.error('DynamoDB updateItem error:', error);
    throw error;
  }
};

/**
 * Delete item
 */
const deleteItem = async (tableName, key) => {
  try {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key
    });
    await docClient.send(command);
    return true;
  } catch (error) {
    console.error('DynamoDB deleteItem error:', error);
    throw error;
  }
};

/**
 * Query items (with GSI support)
 */
const query = async (tableName, keyCondition, options = {}) => {
  try {
    const command = new QueryCommand({
      TableName: tableName,
      IndexName: options.indexName,
      KeyConditionExpression: keyCondition.expression,
      ExpressionAttributeNames: keyCondition.names,
      ExpressionAttributeValues: keyCondition.values,
      Limit: options.limit,
      ScanIndexForward: options.scanForward !== false, // Default: ascending
      ExclusiveStartKey: options.cursor
    });

    const result = await docClient.send(command);
    return {
      items: result.Items || [],
      cursor: result.LastEvaluatedKey || null
    };
  } catch (error) {
    console.error('DynamoDB query error:', error);
    throw error;
  }
};

/**
 * Scan table (use sparingly - prefer Query)
 */
const scan = async (tableName, options = {}) => {
  try {
    const command = new ScanCommand({
      TableName: tableName,
      Limit: options.limit,
      ExclusiveStartKey: options.cursor
    });

    const result = await docClient.send(command);
    return {
      items: result.Items || [],
      cursor: result.LastEvaluatedKey || null
    };
  } catch (error) {
    console.error('DynamoDB scan error:', error);
    throw error;
  }
};

module.exports = {
  TABLES,
  getItem,
  putItem,
  updateItem,
  deleteItem,
  query,
  scan,
  docClient
};

