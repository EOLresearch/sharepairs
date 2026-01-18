export interface AuthProvider {
  register(payload: {
    email: string;
    password: string;
  }): Promise<{
    providerUserId: string;
    email: string;
    tokens?: AuthTokens;
  }>;

  /**
   * Only supported by providers like Cognito
   */
  login?(payload: {
    email: string;
    password: string;
  }): Promise<AuthTokens>;

  /**
   * Only supported by providers like Cognito
   */
  refresh?(payload: {
    refreshToken: string;
  }): Promise<AuthTokens>;

  /**
   * Used by Firebase to verify client-issued token
   */
  verifyIdToken?(idToken: string): Promise<{
    providerUserId: string;
    email: string;
  }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
}
