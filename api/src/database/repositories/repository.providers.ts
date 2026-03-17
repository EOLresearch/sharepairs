import { RepositoryTokens } from './tokens';
import { AuthUserDynamoRepository } from '../dynamodb/repositories/auth-user.dynamodb.repository';
import { OtpDynamoRepository } from '../dynamodb/repositories/otp.dynamodb.repository';
import { PasswordResetTokenDynamoRepository } from '../dynamodb/repositories/password-reset-token.dynamodb.repository';

export const RepositoryProviders = [
  {
    provide: RepositoryTokens.AuthUser,
    useClass: AuthUserDynamoRepository,
  },
  {
    provide: RepositoryTokens.OTP,
    useClass: OtpDynamoRepository,
  },
  {
    provide: RepositoryTokens.PasswordResetToken,
    useClass: PasswordResetTokenDynamoRepository,
  },
];
