import { Injectable } from '@nestjs/common';
import { PasswordResetTokenRepository } from '../../interfaces/password-reset-token.repository';
import { PasswordResetToken } from '../../../domain/password-reset-token/password-reset-token.model';
import { DynamoDbClient } from '../dynamodb.client';
import { randomUUID } from 'crypto';

@Injectable()
export class PasswordResetTokenDynamoRepository
  implements PasswordResetTokenRepository
{
  private readonly tableName = 'PasswordResetTokens';
  private readonly userTokenIndex = 'userIdTokenIndex'; // GSI: userId (PK), token (SK)

  constructor(private readonly dynamo: DynamoDbClient) {}

  async create(token: PasswordResetToken): Promise<PasswordResetToken> {
    const tokenWithId = {
      ...token,
      id: token.id || randomUUID(),
    };

    await this.dynamo.put({
      TableName: this.tableName,
      Item: {
        id: tokenWithId.id,
        userId: tokenWithId.userId,
        token: tokenWithId.token,
        status: tokenWithId.status,
        createdAt: tokenWithId.createdAt.toISOString(),
        expiresAt: tokenWithId.expiresAt.toISOString(),
      },
    });

    return tokenWithId;
  }

  async findByUserIdAndToken(
    userId: string,
    token: string,
  ): Promise<PasswordResetToken | null> {
    // Query using GSI with userId and token
    const result = await this.dynamo.query({
      TableName: this.tableName,
      IndexName: this.userTokenIndex,
      KeyConditionExpression: 'userId = :userId AND token = :token',
      FilterExpression: 'status = :status',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':token': token,
        ':status': 'unused',
      },
      Limit: 1,
    });

    if (!result.Items || result.Items.length === 0) return null;

    return this.mapToDomain(result.Items[0]);
  }

  async updateStatus(
    id: string,
    status: 'unused' | 'used' | 'expired',
  ): Promise<void> {
    // Get existing token
    const existing = await this.dynamo.get({
      TableName: this.tableName,
      Key: { id },
    });

    if (!existing.Item) {
      throw new Error('Token not found');
    }

    // Update status
    await this.dynamo.put({
      TableName: this.tableName,
      Item: {
        ...existing.Item,
        status,
      },
    });
  }

  private mapToDomain(item: any): PasswordResetToken {
    return {
      id: item.id,
      userId: item.userId,
      token: item.token,
      status: item.status,
      createdAt: new Date(item.createdAt),
      expiresAt: new Date(item.expiresAt),
    };
  }
}
