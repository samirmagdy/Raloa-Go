import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { FirebaseServerVerifier } from '@raloa/auth';

let verifier: FirebaseServerVerifier | undefined;

export function getFirebaseServerVerifier(): FirebaseServerVerifier {
  if (verifier) return verifier;
  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  const auth = getAuth(app);
  verifier = {
    async verifyIdToken(token) {
      try {
        const decoded = await auth.verifyIdToken(token);
        return { firebaseUid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified, expiresAt: decoded.exp };
      } catch { return null; }
    },
    async verifySessionCookie(cookie) {
      try {
        const decoded = await auth.verifySessionCookie(cookie, true);
        return { firebaseUid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified, expiresAt: decoded.exp };
      } catch { return null; }
    },
    async revokeRefreshTokens(firebaseUid) {
      await auth.revokeRefreshTokens(firebaseUid);
    }
  };
  return verifier;
}
