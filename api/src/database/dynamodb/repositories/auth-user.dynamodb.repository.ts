import { Injectable } from '@nestjs/common';
import { AuthUserRepository } from '../../interfaces/auth-user.repository';
import { AuthUser } from '../../../domain/auth-user/auth-user.model';
import { DynamoDbClient } from '../dynamodb.client';

@Injectable()
export class AuthUserDynamoRepository implements AuthUserRepository {
  private readonly tableName = 'AuthUsers';
  private readonly providerIndex = 'providerUserIndex';

  constructor(private readonly dynamo: DynamoDbClient) {}

  async findByProviderId(
    provider: 'firebase' | 'cognito',
    providerUserId: string,
  ): Promise<AuthUser | null> {
    const result = await this.dynamo.query({
      TableName: this.tableName,
      IndexName: this.providerIndex,
      KeyConditionExpression:
        'provider = :provider AND providerUserId = :providerUserId',
      ExpressionAttributeValues: {
        ':provider': provider,
        ':providerUserId': providerUserId,
      },
      Limit: 1,
    });

    if (!result.Items || result.Items.length === 0) return null;

    return this.mapToDomain(result.Items[0]);
  }

  async findById(userId: string): Promise<AuthUser | null> {
    const result = await this.dynamo.get({
      TableName: this.tableName,
      Key: {
        id: userId,
      },
    });

    if (!result.Item) return null;

    return this.mapToDomain(result.Item);
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    // Note: This requires an email GSI in DynamoDB
    // Create a GSI with email as partition key for efficient lookups
    // For now, this assumes the index exists
    try {
      const result = await this.dynamo.query({
        TableName: this.tableName,
        IndexName: 'emailIndex', // GSI: email (PK)
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
        Limit: 1,
      });

      if (!result.Items || result.Items.length === 0) return null;

      return this.mapToDomain(result.Items[0]);
    } catch (error) {
      // If index doesn't exist, return null
      // In production, ensure the emailIndex GSI is created
      console.warn('emailIndex GSI not found. Please create it in DynamoDB.');
      return null;
    }
  }

  async create(user: AuthUser): Promise<AuthUser> {
    await this.dynamo.put({
      TableName: this.tableName,
      Item: {
        id: user.id,
        providerUserId: user.providerUserId,
        email: user.email,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified ?? false,
        createdAt: user.createdAt.toISOString(),
      },
    });

    return user;
  }

  async update(userId: string, updates: Partial<AuthUser>): Promise<AuthUser> {
    // First get the existing user
    const existing = await this.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    // Merge updates
    const updated: AuthUser = {
      ...existing,
      ...updates,
    };

    // Update in DynamoDB
    await this.dynamo.put({
      TableName: this.tableName,
      Item: {
        id: updated.id,
        providerUserId: updated.providerUserId,
        email: updated.email,
        isAdmin: updated.isAdmin,
        isVerified: updated.isVerified ?? false,
        createdAt: updated.createdAt.toISOString(),
      },
    });

    return updated;
  }

  private mapToDomain(item: any): AuthUser {
    return {
      id: item.id,
      providerUserId: item.providerUserId,
      email: item.email,
      isAdmin: item.isAdmin,
      isVerified: item.isVerified ?? false,
      createdAt: new Date(item.createdAt),
    };
  }
}
