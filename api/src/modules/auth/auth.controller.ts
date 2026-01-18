import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* AUTHENTICATION ENDPOINTS                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Register a new user
   * POST /auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      displayName: string;
    },
  ) {
    return await this.authService.register(body);
  }

  /**
   * Login user
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body()
    body: {
      email?: string;
      password?: string;
      idToken?: string;
    },
  ) {
    return await this.authService.login(body);
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return await this.authService.refresh(body);
  }

  /* ------------------------------------------------------------------ */
  /* OTP ENDPOINTS                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Send OTP to user's email
   * POST /auth/send-otp
   */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(
    @Body()
    body: {
      email: string;
      reason: 'verify_user' | 'reset_pass';
    },
  ) {
    return await this.otpService.sendOtp(body);
  }

  /**
   * Verify OTP code
   * POST /auth/verify-otp
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body()
    body: {
      email: string;
      otp: string;
    },
  ) {
    return await this.otpService.verifyOtp(body);
  }

  /**
   * Reset password using reset token
   * POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body()
    body: {
      newPassword: string;
      token: string;
    },
  ) {
    const result = await this.otpService.resetPassword(
      body.newPassword,
      body.token,
    );
    return {
      message: result,
    };
  }

  /* ------------------------------------------------------------------ */
  /* OTP GENERATION (Alternative endpoint)                              */
  /* ------------------------------------------------------------------ */


  /**
   * Validate OTP (alternative endpoint)
   * POST /auth/validate-otp
   */
  @Post('validate-otp')
  @HttpCode(HttpStatus.OK)
  async validateOtp(
    @Body()
    body: {
      identifier: string;
      purpose: 'verify_user' | 'reset_pass';
      otpCode: string;
    },
  ) {
    return await this.authService.validateOTP(body);
  }
}
