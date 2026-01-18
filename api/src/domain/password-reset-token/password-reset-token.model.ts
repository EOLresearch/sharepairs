export interface PasswordResetToken {
  id: string; // Unique identifier
  userId: string; // User ID
  token: string; // JWT token
  status: 'unused' | 'used' | 'expired'; // Token status
  createdAt: Date; // Creation timestamp
  expiresAt: Date; // Expiration timestamp
}
