import { AuthUser } from '../../domain/auth-user/auth-user.model';
export interface AuthUserRepository {
  findByProviderId(
    provider: 'firebase' | 'cognito',
    providerUserId: string,
  ): Promise<AuthUser | null>;

  findById(userId: string): Promise<AuthUser | null>;

  findByEmail(email: string): Promise<AuthUser | null>;

  create(user: AuthUser): Promise<AuthUser>;

  update(userId: string, updates: Partial<AuthUser>): Promise<AuthUser>;
}
