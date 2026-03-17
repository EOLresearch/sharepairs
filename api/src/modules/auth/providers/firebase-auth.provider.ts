import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AuthProvider } from './auth-provider.interface';

@Injectable()
export class FirebaseAuthProvider implements AuthProvider {
  async register({ email, password }: { email: string; password: string }) {
    try {
      const user = await admin.auth().createUser({ email, password });

      // Create custom token for immediate login
      const customToken = await admin.auth().createCustomToken(user.uid);

      return {
        providerUserId: user.uid,
        email: user.email!,
        tokens: {
          accessToken: customToken, // exchanged on client
          expiresIn: 3600,
        },
      };
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        throw new UnauthorizedException('User already exists');
      }
      throw new UnauthorizedException('Firebase registration failed');
    }
  }

  async verifyIdToken(idToken: string) {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      return {
        providerUserId: decoded.uid,
        email: decoded.email!,
      };
    } catch {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }
  }
}
