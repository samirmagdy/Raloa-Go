import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseServerVerifier } from '../../../../server/firebase-admin';
import { getCurrentUser } from '../../../../server/auth';
import { authErrorResponse } from '../../../../server/auth-response';
import { getApps, initializeApp } from 'firebase-admin/app';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ status: 'error', error: 'UNAUTHORIZED', code: 'UNAUTHORIZED', message: 'A Firebase ID token is required.' }, { status: 401 });
    const verifier = getFirebaseServerVerifier();
    const identity = await verifier.verifyIdToken(token);
    if (!identity) return NextResponse.json({ status: 'error', error: 'UNAUTHORIZED', code: 'UNAUTHORIZED', message: 'Invalid Firebase ID token.' }, { status: 401 });
    const app = getApps().length ? getApps()[0] : initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    const cookie = await getAuth(app).createSessionCookie(token, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 });
    const response = NextResponse.json({ status: 'ok', user: await getCurrentUser() });
    response.cookies.set('raloa_session', cookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE_SECONDS });
    return response;
  } catch (error) { return authErrorResponse(error); }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ status: 'error', error: 'UNAUTHORIZED', code: 'UNAUTHORIZED', message: 'Not authenticated.' }, { status: 401 });
    return NextResponse.json({ status: 'ok', user });
  } catch (error) { return authErrorResponse(error); }
}
