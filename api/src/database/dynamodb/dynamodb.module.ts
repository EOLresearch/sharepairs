import { Module } from '@nestjs/common';
import { DynamodbService } from './dynamodb.service';
import { DynamoDbClient } from './dynamodb.client';
import { AuthUserDynamoRepository } from './repositories/auth-user.dynamodb.repository';
import { OtpDynamoRepository } from './repositories/otp.dynamodb.repository';
import { PasswordResetTokenDynamoRepository } from './repositories/password-reset-token.dynamodb.repository';
@Module({
  providers: [
    DynamodbService,
    DynamoDbClient,
    AuthUserDynamoRepository,
    OtpDynamoRepository,
    PasswordResetTokenDynamoRepository,
  ],
  exports: [
    DynamoDbClient, // Export DynamoDbClient so it's available to repositories
    AuthUserDynamoRepository,
    OtpDynamoRepository,
    PasswordResetTokenDynamoRepository,
  ],
})
export class DynamodbModule {}
