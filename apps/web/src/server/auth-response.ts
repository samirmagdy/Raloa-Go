import { NextResponse } from 'next/server';
import { AuthBoundaryError } from '@raloa/auth';

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthBoundaryError) {
    return NextResponse.json({ status: 'error', error: error.code, code: error.code, message: error.message }, { status: error.statusCode });
  }
  console.error('[Next auth boundary]', error);
  return NextResponse.json({ status: 'error', error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', message: 'Authentication service unavailable.' }, { status: 500 });
}
