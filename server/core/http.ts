import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { AuthenticationError, formatErrorResponse, ApplicationError } from './errors';

export * from './errors';

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sendApiError(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  return formatErrorResponse(res, new ApplicationError({ code, message, statusCode: status, fields }));
}

export function requireActor(req: Request, res: Response): { uid: string; email?: string } | null {
  const actor = (req as Request & { user?: { uid: string; email?: string } }).user;
  if (actor) return actor;
  throw new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED');
}
