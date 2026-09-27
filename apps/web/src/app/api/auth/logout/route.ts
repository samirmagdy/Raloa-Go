import { NextResponse } from 'next/server';
import { getFirebaseServerVerifier } from '../../../../server/firebase-admin';

export async function POST(request: Request) {
  const response = NextResponse.json({ status: 'ok' });
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (token) {
    const verifier = getFirebaseServerVerifier();
    const identity = await verifier.verifyIdToken(token);
    if (identity && verifier.revokeRefreshTokens) {
      try { await verifier.revokeRefreshTokens(identity.firebaseUid); } catch (error) { console.warn('[Next auth logout]', error); }
    }
  }
  response.cookies.set('raloa_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
