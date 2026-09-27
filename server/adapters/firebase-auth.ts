import type { Auth } from 'firebase-admin/auth';
import type { AuthenticatedUser } from '../../server-services';

export interface FirebaseAuthAdapter {
  verifyBearerToken(token: string): Promise<AuthenticatedUser | null>;
}

export function createFirebaseAuthAdapter(auth: Pick<Auth, 'verifyIdToken'>): FirebaseAuthAdapter {
  return {
    async verifyBearerToken(token) {
      try {
        const decoded = await auth.verifyIdToken(token);
        return { uid: decoded.uid, email: decoded.email };
      } catch {
        return null;
      }
    }
  };
}

