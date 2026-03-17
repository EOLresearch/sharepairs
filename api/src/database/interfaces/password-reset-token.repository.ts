import { PasswordResetToken } from '../../domain/password-reset-token/password-reset-token.model';

export interface PasswordResetTokenRepository {
  /**
   * Create a password reset token
   */
  create(token: PasswordResetToken): Promise<PasswordResetToken>;

  /**
   * Find token by user ID and token string
   */
  findByUserIdAndToken(
    userId: string,
    token: string,
  ): Promise<PasswordResetToken | null>;

  /**
   * Update token status
   */
  updateStatus(
    id: string,
    status: 'unused' | 'used' | 'expired',
  ): Promise<void>;
}
