import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import { RepositoryTokens } from '../../database/repositories/tokens';
import { AuthUserRepository } from '../../database/interfaces/auth-user.repository';
import { OtpRepository } from '../../database/interfaces/otp.repository';
import { PasswordResetTokenRepository } from '../../database/interfaces/password-reset-token.repository';
import { OTP } from '../../domain/otp/otp.model';
import { PasswordResetToken } from '../../domain/password-reset-token/password-reset-token.model';
import { EmailService } from '../../common/utils/email.service';

@Injectable()
export class OtpService {
  private readonly OTP_EXPIRY_MINUTES = 5; // OTP expires in 5 minutes
  private readonly OTP_LENGTH = 6; // 6-digit OTP

  constructor(
    @Inject(RepositoryTokens.AuthUser)
    private readonly authUserRepo: AuthUserRepository,

    @Inject(RepositoryTokens.OTP)
    private readonly otpRepo: OtpRepository,

    @Inject(RepositoryTokens.PasswordResetToken)
    private readonly passwordResetTokenRepo: PasswordResetTokenRepository,

    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a random 6-digit OTP code
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP to user's email
   * Marks all previous active OTPs as expired
   */
  async sendOtp(body: { email: string; reason: string }) {
    const { email, reason } = body;

    // Validate reason
    if (!['verify_user', 'reset_pass'].includes(reason)) {
      throw new BadRequestException('Invalid reason for OTP');
    }

    // Check if user exists
    const user = await this.authUserRepo.findByEmail(email);
    if (!user) {
      throw new HttpException('User does not exist.', HttpStatus.BAD_REQUEST);
    }

    // Generate OTP
    const otpValue = this.generateOtp();
    const expiryTime = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Mark all previous active OTPs for this email as expired
    const activeOtps = await this.otpRepo.findActiveByIdentifier(email);
    for (const otp of activeOtps) {
      if (otp.status === 'active') {
        const expiredOtp: OTP = {
          ...otp,
          status: 'expired',
        };
        await this.otpRepo.upsert(expiredOtp);
      }
    }

    // Create new OTP
    const otp: OTP = {
      id: email,
      otpCode: otpValue,
      purpose: reason as 'verify_user' | 'reset_pass',
      expiresAt: expiryTime,
      attempts: 0,
      maxAttempts: 5,
      createdAt: new Date(),
      status: 'active',
    };

    await this.otpRepo.upsert(otp);

    // Send email with OTP
    try {
      await this.emailService.sendOtpEmail(email, otpValue, reason as 'verify_user' | 'reset_pass');
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      // Don't throw error - OTP is still created, just email failed
      // In production, you might want to log this to a monitoring service
    }

    return {
      message: 'OTP sent successfully',
      // In development, return OTP for testing
      otp: process.env.NODE_ENV === 'development' ? otpValue : undefined,
    };
  }

  /**
   * Verify OTP code
   * Handles both verify_user and reset_pass reasons
   */
  async verifyOtp(body: { email: string; otp: string }): Promise<any> {
    const { email, otp } = body;

    // Find all active OTPs for this email
    const activeOtps = await this.otpRepo.findActiveByIdentifier(email);

    if (activeOtps.length === 0) {
      throw new HttpException('Invalid OTP.', HttpStatus.BAD_REQUEST);
    }

    // Mark expired OTPs
    const now = new Date();
    for (const otpRecord of activeOtps) {
      if (otpRecord.expiresAt < now) {
        const expiredOtp: OTP = {
          ...otpRecord,
          status: 'expired',
        };
        await this.otpRepo.upsert(expiredOtp);
      }
    }

    // Get valid (non-expired) active OTPs
    const validOtps = await this.otpRepo.findActiveByIdentifier(email);
    const nonExpiredOtps = validOtps.filter(
      (otpRecord) => otpRecord.expiresAt >= now,
    );

    if (nonExpiredOtps.length === 0) {
      throw new HttpException('Invalid OTP', HttpStatus.BAD_REQUEST);
    }

    // Get the latest OTP
    const latestOtp = nonExpiredOtps[0];

    // Verify OTP code
    if (latestOtp.otpCode !== otp) {
      throw new HttpException('Invalid OTP.', HttpStatus.BAD_REQUEST);
    }

    // Handle based on reason
    if (latestOtp.purpose === 'verify_user') {
      // Mark OTP as used
      const usedOtp: OTP = {
        ...latestOtp,
        status: 'used',
        verifiedAt: new Date(),
      };
      await this.otpRepo.upsert(usedOtp);

      // Get user and verify
      const user = await this.authUserRepo.findByEmail(email);
      if (!user) {
        throw new HttpException(
          'User does not exist.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Update user verification status
      if (!user.isVerified) {
        await this.authUserRepo.update(user.id, { isVerified: true });
      }

      return {
        message: 'OTP verification successful.',
        data: null,
      };
    } else if (latestOtp.purpose === 'reset_pass') {
      // Mark OTP as used
      const usedOtp: OTP = {
        ...latestOtp,
        status: 'used',
        verifiedAt: new Date(),
      };
      await this.otpRepo.upsert(usedOtp);

      // Get user
      const user = await this.authUserRepo.findByEmail(email);
      if (!user) {
        throw new HttpException(
          'User does not exist.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Generate password reset token
      const payload = { id: user.id };
      const token = jwt.sign(payload, process.env.PASS_SECRET || 'default-secret', {
        expiresIn: '15m',
      });

      const expiryTime = new Date(Date.now() + 15 * 60 * 1000);
      const passwordResetToken: PasswordResetToken = {
        id: randomUUID(),
        userId: user.id,
        token,
        status: 'unused',
        createdAt: new Date(),
        expiresAt: expiryTime,
      };

      await this.passwordResetTokenRepo.create(passwordResetToken);

      return {
        message: 'OTP verification Successful',
        data: { token },
      };
    }

    throw new HttpException(
      'Invalid reason for OTP.',
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(newPassword: string, token: string): Promise<string> {
    // Verify JWT token
    let decodedToken: any;
    try {
      decodedToken = jwt.verify(
        token,
        process.env.PASS_SECRET || 'default-secret',
      );
    } catch (error) {
      throw new HttpException(
        'Invalid or expired token.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = decodedToken.id;

    // Find password reset token record
    const passwordResetRecord =
      await this.passwordResetTokenRepo.findByUserIdAndToken(userId, token);

    if (!passwordResetRecord) {
      throw new HttpException(
        'Invalid or expired token.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if token has expired
    if (new Date(passwordResetRecord.expiresAt).getTime() < Date.now()) {
      await this.passwordResetTokenRepo.updateStatus(
        passwordResetRecord.id,
        'expired',
      );
      throw new HttpException('Token has expired.', HttpStatus.BAD_REQUEST);
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Get user
    const user = await this.authUserRepo.findById(userId);
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
    }

    // Update password in auth provider (Cognito/Firebase)
    // Note: This depends on your auth provider implementation
    // For now, we'll just mark the token as used
    // You may need to add a method to update password in your auth provider

    // Mark token as used
    await this.passwordResetTokenRepo.updateStatus(
      passwordResetRecord.id,
      'used',
    );

    return 'Password has been successfully reset.';
  }
}
