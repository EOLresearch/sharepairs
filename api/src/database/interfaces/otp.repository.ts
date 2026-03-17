import { OTP } from '../../domain/otp/otp.model';

export interface OtpRepository {
  /**
   * Create or update an OTP record
   */
  upsert(otp: OTP): Promise<OTP>;

  /**
   * Find OTP by identifier (email/phone) and purpose
   */
  findByIdentifierAndPurpose(
    id: string,
    purpose:  'verify_user' | 'reset_pass',
  ): Promise<OTP | null>;

  /**
   * Find all active OTPs for an identifier, ordered by creation date
   */
  findActiveByIdentifier(id: string): Promise<OTP[]>;

  /**
   * Delete OTP record
   */
  delete(id: string, purpose:  'verify_user' | 'reset_pass'): Promise<void>;

  /**
   * Delete expired OTPs (cleanup)
   */
  deleteExpired(): Promise<void>;
}
