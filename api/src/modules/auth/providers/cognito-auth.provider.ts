import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthProvider } from './auth-provider.interface';

@Injectable()
export class CognitoAuthProvider implements AuthProvider {
  private client: CognitoIdentityProviderClient;

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
    });
  }

  /**
   * REGISTER USER
   * - Creates user in Cognito
   * - Auto-confirms user (no email OTP flow)
   * - Logs user in immediately
   */
  async register(payload: { email: string; password: string }) {
    try {
      // 1️⃣ Sign up user
      const signUpCommand = new SignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID!,
        Username: payload.email,
        Password: payload.password,
        UserAttributes: [
          {
            Name: 'email',
            Value: payload.email,
          },
        ],
      });

      const signUpResponse = await this.client.send(signUpCommand);

      // 2️⃣ Auto-confirm user (optional but common)
      const confirmCommand = new AdminConfirmSignUpCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: payload.email,
      });

      await this.client.send(confirmCommand);

      // 3️⃣ Auto-login after registration
      const tokens = await this.login({
        email: payload.email,
        password: payload.password,
      });

      return {
        providerUserId: signUpResponse.UserSub!,
        email: payload.email,
        tokens,
      };
    } catch (err: any) {
      if (err.name === 'UsernameExistsException') {
        throw new ConflictException('User already exists');
      }

      throw new InternalServerErrorException(
        'Cognito registration failed',
      );
    }
  }

  /**
   * LOGIN USER
   * - Verifies email + password
   * - Returns Cognito JWTs
   */
  async login(payload: { email: string; password: string }) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthParameters: {
          USERNAME: payload.email,
          PASSWORD: payload.password,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Authentication failed');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken!,
        refreshToken: response.AuthenticationResult.RefreshToken,
        idToken: response.AuthenticationResult.IdToken!,
        expiresIn: response.AuthenticationResult.ExpiresIn!,
      };
    } catch {
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  /**
   * REFRESH TOKEN
   * - Issues new access + ID token
   */
  async refresh(payload: { refreshToken: string }) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthParameters: {
          REFRESH_TOKEN: payload.refreshToken,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        expiresIn: response.AuthenticationResult.ExpiresIn!,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
