import { Injectable } from '@nestjs/common';
import { OtpRepository } from '../../interfaces/otp.repository';
import { OTP } from '../../../domain/otp/otp.model';
import { DynamoDbClient } from '../dynamodb.client';

@Injectable()
export class OtpDynamoRepository implements OtpRepository {
  private readonly tableName = 'OTPs';

  constructor(private readonly dynamo: DynamoDbClient) {}

  async upsert(otp: OTP): Promise<OTP> {
    await this.dynamo.put({
      TableName: this.tableName,
      Item: {
        id: otp.id,
        purpose: otp.purpose,
        otpCode: otp.otpCode,
        expiresAt: otp.expiresAt.toISOString(),
        attempts: otp.attempts,
        maxAttempts: otp.maxAttempts,
        createdAt: otp.createdAt.toISOString(),
        verifiedAt: otp.verifiedAt ? otp.verifiedAt.toISOString() : undefined,
        status: otp.status,
      },
    });

    return otp;
  }

  async findByIdentifierAndPurpose(
    id: string,
    purpose:  'verify_user' | 'reset_pass',
  ): Promise<OTP | null> {
    const result = await this.dynamo.get({
      TableName: this.tableName,
      Key: {
        id: id,
        purpose: purpose,
      },
    });

    if (!result.Item) return null;

    return this.mapToDomain(result.Item);
  }

  async findActiveByIdentifier(id: string): Promise<OTP[]> {
    // Query all OTPs for this identifier with status 'active'
    // Note: This requires a GSI on id (partition key) and status (sort key)
    // For now, we'll query by id and filter by status
    const result = await this.dynamo.query({
      TableName: this.tableName,
      KeyConditionExpression: 'id = :id',
      FilterExpression: 'status = :status',
      ExpressionAttributeValues: {
        ':id': id,
        ':status': 'active',
      },
    });

    if (!result.Items || result.Items.length === 0) return [];

    return result.Items.map((item) => this.mapToDomain(item)).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async delete(
    id: string,
    purpose:  'verify_user' | 'reset_pass',
  ): Promise<void> {
    await this.dynamo.delete({
      TableName: this.tableName,
      Key: {
        id: id,
        purpose: purpose,
      },
    });
  }

  async deleteExpired(): Promise<void> {
    // Note: DynamoDB doesn't support efficient range queries on expiration
    // This would typically be handled by a scheduled job or TTL attribute
    // For now, we'll implement a basic scan (not recommended for production at scale)
    // In production, use DynamoDB TTL feature with a background cleanup job
    const now = new Date().toISOString();
    
    // This is a simplified implementation
    // In production, use DynamoDB TTL or a separate cleanup service
    // For now, expired OTPs will be checked during validation
  }

  private mapToDomain(item: any): OTP {
    return {
      id: item.id,
      otpCode: item.otpCode,
      purpose: item.purpose,
      expiresAt: new Date(item.expiresAt),
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      createdAt: new Date(item.createdAt),
      verifiedAt: item.verifiedAt ? new Date(item.verifiedAt) : undefined,
      status: item.status || 'active',
    };
  }
}
