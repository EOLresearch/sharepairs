export interface OTP {
  id: string; // Unique identifier (email or phone)
  otpCode: string; // The OTP code
  purpose:  'verify_user' | 'reset_pass'; // Purpose of OTP
  expiresAt: Date; // Expiration timestamp
  attempts: number; // Number of validation attempts
  maxAttempts: number; // Maximum allowed attempts
  createdAt: Date; // Creation timestamp
  verifiedAt?: Date; // When OTP was verified (optional)
  status: 'active' | 'expired' | 'used'; // OTP status
}
