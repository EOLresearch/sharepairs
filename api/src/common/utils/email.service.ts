import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';

@Injectable()
export class EmailService {
  private oAuth2Client;

  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(
      process.env.EMAIL_CLIENT_ID,
      process.env.EMAIL_CLIENT_SECRET,
      process.env.EMAIL_REDIRECT_URI,
    );

    this.oAuth2Client.setCredentials({
      refresh_token: process.env.EMAIL_REFRESH_TOKEN,
    });
  }

  /**
   * Send OTP email to user
   */
  async sendOtpEmail(email: string, otp: string, reason: 'verify_user' | 'reset_pass'): Promise<void> {
    const subject = reason === 'verify_user' 
      ? 'Email Verification OTP' 
      : 'Password Reset OTP';
    
    const html = this.getOtpEmailTemplate(otp, reason);

    await this.sendMail({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Generic email sending method
   */
  async sendMail(data: { to: string; subject: string; html: string }): Promise<void> {
    try {
      const ACCESS_TOKEN = await this.oAuth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.EMAIL_USER,
          clientId: process.env.EMAIL_CLIENT_ID,
          clientSecret: process.env.EMAIL_CLIENT_SECRET,
          refreshToken: process.env.EMAIL_REFRESH_TOKEN,
          accessToken: ACCESS_TOKEN,
        },
        tls: {
          rejectUnauthorized: true,
        },
      });

      const { to, subject, html } = data;
      const mailOptions = {
        from: `"Share Pairs" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      };

      return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (err) => {
          if (err) {
            console.error('Email sending error: ', err);
            reject({
              result: false,
              reason: 'Mail not sent',
            });
          } else {
            console.log('Email sent successfully to:', to);
            resolve();
          }
        });
      });
    } catch (err) {
      console.error('Email service error: ', err);
      throw err;
    }
  }

  /**
   * Generate OTP email HTML template
   */
  private getOtpEmailTemplate(otp: string, reason: 'verify_user' | 'reset_pass'): string {
    const title = reason === 'verify_user' 
      ? 'Email Verification' 
      : 'Password Reset';
    
    const message = reason === 'verify_user'
      ? 'Please use the following OTP to verify your email address:'
      : 'Please use the following OTP to reset your password:';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
          <h2 style="color: #2c3e50; margin-top: 0;">${title}</h2>
          <p>${message}</p>
          <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #3498db; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #7f8c8d; font-size: 12px;">
            This OTP will expire in 5 minutes. If you didn't request this OTP, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #7f8c8d; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Share Pairs. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}
