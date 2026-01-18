import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../../database/database.module';
import { AuthProviderProvider } from './providers/auth-provider.factory';
import { EmailService } from '../../common/utils/email.service';

@Module({
  imports: [DatabaseModule],
  providers: [AuthService, OtpService, AuthProviderProvider, EmailService],
  controllers: [AuthController],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
