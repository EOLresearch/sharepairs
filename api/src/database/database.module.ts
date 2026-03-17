import { Module } from '@nestjs/common';
import { DynamodbModule } from './dynamodb/dynamodb.module';
import { RepositoryProviders } from './repositories/repository.providers';
import { AuthUserDynamoRepository } from './dynamodb/repositories/auth-user.dynamodb.repository';
import { OtpDynamoRepository } from './dynamodb/repositories/otp.dynamodb.repository';
import { PasswordResetTokenDynamoRepository } from './dynamodb/repositories/password-reset-token.dynamodb.repository';

@Module({


  imports: [ DynamodbModule],
  providers: [
    ...RepositoryProviders,
  ],
  exports: [
    ...RepositoryProviders,
  ]
})
export class DatabaseModule {}
