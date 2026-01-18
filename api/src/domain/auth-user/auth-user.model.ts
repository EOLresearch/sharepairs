export interface AuthUser {
  id: string;
  providerUserId: string;
  email: string;
  isAdmin: boolean;
  isVerified?: boolean;
  createdAt: Date;
}
