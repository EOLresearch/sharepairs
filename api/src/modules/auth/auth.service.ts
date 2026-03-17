import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AuthProvider } from './providers/auth-provider.interface';
import { AUTH_PROVIDER_TOKEN } from './providers/auth-provider.factory';

import { RepositoryTokens } from '../../database/repositories/tokens';
import { AuthUserRepository } from '../../database/interfaces/auth-user.repository';
import { OtpRepository } from '../../database/interfaces/otp.repository';
import { OTP } from '../../domain/otp/otp.model';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRY_MINUTES = 10; // OTP expires in 10 minutes
  private readonly OTP_MAX_ATTEMPTS = 5; // Maximum validation attempts
  private readonly OTP_LENGTH = 6; // 6-digit OTP

  constructor(
    @Inject(RepositoryTokens.AuthUser)
    private readonly authUserRepo: AuthUserRepository,

    @Inject(RepositoryTokens.OTP)
    private readonly otpRepo: OtpRepository,

    @Inject(AUTH_PROVIDER_TOKEN)
    private readonly authProvider: AuthProvider,
  ) {}

  /* ------------------------------------------------------------------ */
  /* REGISTER                                                           */
  /* ------------------------------------------------------------------ */

  async register(payload: {
    email: string;
    password: string;
    displayName: string;
  }) {
    if (!payload.email || !payload.password) {
      throw new BadRequestException('Email and password are required');
    }

    let providerResult;
    try {
      providerResult = await this.authProvider.register({
        email: payload.email,
        password: payload.password,
      });
    } catch (err) {
      // Pass through known errors
      if (err instanceof ConflictException) throw err;
      if (err instanceof UnauthorizedException) throw err;

      throw new InternalServerErrorException(
        'Failed to register user with auth provider',
      );
    }

    const { providerUserId, email, tokens } = providerResult;

    // Check if backend user already exists
    const existing = await this.authUserRepo.findByProviderId(
      process.env.AUTH_PROVIDER as any,
      providerUserId,
    );

    if (existing) {
      throw new ConflictException('User already exists in system');
    }

    try {
      const user = await this.authUserRepo.create({
        id: randomUUID(),
        providerUserId,
        email,
        isAdmin: false,
        isVerified: false,
        createdAt: new Date(),
      });

      return {
        user: {
          id: user.id,
          email: user.email,
        },
        tokens: tokens ?? null, // Firebase → custom token | Cognito → real tokens
      };
    } catch {
      throw new InternalServerErrorException(
        'Failed to persist user after registration',
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* LOGIN                                                              */
  /* ------------------------------------------------------------------ */

  async login(payload: {
    email?: string;
    password?: string;
    idToken?: string;
  }) {
    /**
     * 🔵 FIREBASE FLOW
     * Client logs in → sends ID token → backend verifies
     */
    if (process.env.AUTH_PROVIDER === 'firebase') {
      if (!payload.idToken) {
        throw new BadRequestException('idToken is required for Firebase login');
      }

      if (!this.authProvider.verifyIdToken) {
        throw new InternalServerErrorException(
          'verifyIdToken not implemented for Firebase provider',
        );
      }

      let identity;
      try {
        identity = await this.authProvider.verifyIdToken(payload.idToken);
      } catch {
        throw new UnauthorizedException('Invalid Firebase ID token');
      }

      const user = await this.authUserRepo.findByProviderId(
        'firebase',
        identity.providerUserId,
      );

      if (!user) {
        throw new UnauthorizedException(
          'User authenticated but not registered in backend',
        );
      }

      return {
        user: {
          id: user.id,
          email: user.email,
        },
      };
    }

    /**
     * 🟠 COGNITO FLOW
     * Backend sends email + password → Cognito → tokens
     */
    if (process.env.AUTH_PROVIDER === 'cognito') {
      if (!payload.email || !payload.password) {
        throw new BadRequestException('Email and password are required');
      }

      if (!this.authProvider.login) {
        throw new InternalServerErrorException(
          'login() not implemented for Cognito provider',
        );
      }

      let tokens;
      try {
        tokens = await this.authProvider.login({
          email: payload.email,
          password: payload.password,
        });
      } catch {
        throw new UnauthorizedException('Invalid email or password');
      }

      return tokens;
    }

    throw new InternalServerErrorException('Invalid AUTH_PROVIDER configuration');
  }

  /* ------------------------------------------------------------------ */
  /* REFRESH TOKEN                                                      */
  /* ------------------------------------------------------------------ */

  async refresh(payload: { refreshToken: string }) {
    if (!payload.refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }

    if (!this.authProvider.refresh) {
      throw new UnauthorizedException(
        'Token refresh must be handled on client',
      );
    }

    try {
      return await this.authProvider.refresh({
        refreshToken: payload.refreshToken,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /* ------------------------------------------------------------------ */
  /* OTP GENERATION                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Generate and store an OTP for the given identifier (email/phone) and purpose
   */
  async generateOTP(payload: {
    identifier: string; // email or phone number
    purpose: 'verify_user' | 'reset_pass';
  }): Promise<{ otpCode: string; expiresAt: Date }> {
    if (!payload.identifier || !payload.purpose) {
      throw new BadRequestException('Identifier and purpose are required');
    }

    // Generate 6-digit OTP
    const otpCode = this.generateOTPCode();

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Create or update OTP record
    const otp: OTP = {
      id: payload.identifier,
      otpCode,
      purpose: payload.purpose,
      expiresAt,
      attempts: 0,
      maxAttempts: this.OTP_MAX_ATTEMPTS,
      createdAt: new Date(),
      status: 'active',
    };

    await this.otpRepo.upsert(otp);

    return {
      otpCode, // In production, you might want to send this via email/SMS instead
      expiresAt,
    };
  }

  /* ------------------------------------------------------------------ */
  /* OTP VALIDATION                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Validate an OTP code for the given identifier and purpose
   */
  async validateOTP(payload: {
    identifier: string;
    purpose: 'verify_user' | 'reset_pass';
    otpCode: string;
  }): Promise<{ valid: boolean; message?: string }> {
    if (!payload.identifier || !payload.purpose || !payload.otpCode) {
      throw new BadRequestException(
        'Identifier, purpose, and OTP code are required',
      );
    }

    // Find OTP record
    const otp = await this.otpRepo.findByIdentifierAndPurpose(
      payload.identifier,
      payload.purpose,
    );

    if (!otp) {
      return {
        valid: false,
        message: 'OTP not found or expired',
      };
    }

    // Check if OTP has expired
    if (new Date() > otp.expiresAt) {
      await this.otpRepo.delete(payload.identifier, payload.purpose);
      return {
        valid: false,
        message: 'OTP has expired',
      };
    }

    // Check if max attempts exceeded
    if (otp.attempts >= otp.maxAttempts) {
      await this.otpRepo.delete(payload.identifier, payload.purpose);
      return {
        valid: false,
        message: 'Maximum validation attempts exceeded',
      };
    }

    // Increment attempts
    otp.attempts += 1;

    // Validate OTP code
    if (otp.otpCode !== payload.otpCode) {
      await this.otpRepo.upsert(otp);
      return {
        valid: false,
        message: 'Invalid OTP code',
      };
    }

    // OTP is valid - mark as verified and delete
    otp.verifiedAt = new Date();
    await this.otpRepo.upsert(otp);

    // Optionally delete after successful validation
    // await this.otpRepo.delete(payload.identifier, payload.purpose);

    return {
      valid: true,
      message: 'OTP validated successfully',
    };
  }

  /* ------------------------------------------------------------------ */
  /* OTP VERIFICATION (validate and return success)                    */
  /* ------------------------------------------------------------------ */

  /**
   * Verify OTP and return success/error
   * This is a convenience method that throws exceptions on failure
   */
  async verifyOTP(payload: {
    identifier: string;
    purpose: 'verify_user' | 'reset_pass';
    otpCode: string;
  }): Promise<{ success: boolean }> {
    const result = await this.validateOTP(payload);

    if (!result.valid) {
      throw new UnauthorizedException(result.message || 'OTP validation failed');
    }

    // Delete OTP after successful verification
    await this.otpRepo.delete(payload.identifier, payload.purpose);

    return { success: true };
  }

  /* ------------------------------------------------------------------ */
  /* HELPER METHODS                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Generate a random 6-digit OTP code
   */
  private generateOTPCode(): string {
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    const otp = Math.floor(Math.random() * (max - min + 1)) + min;
    return otp.toString().padStart(this.OTP_LENGTH, '0');
  }
}
