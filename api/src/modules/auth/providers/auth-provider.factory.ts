import { CognitoAuthProvider } from './cognito-auth.provider';
import { AuthProvider } from './auth-provider.interface';

/**
 * Injection token for AuthProvider
 */
export const AUTH_PROVIDER_TOKEN = Symbol('AUTH_PROVIDER_TOKEN');

export const AuthProviderProvider = {
  provide: AUTH_PROVIDER_TOKEN,
  useClass: CognitoAuthProvider,
};
