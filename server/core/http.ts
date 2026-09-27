import type { NextFunction, Request, Response, RequestHandler } from 'express';

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sendApiError(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  return res.status(status).json({ status: 'error', error: code, code, message, ...(fields ? { fields } : {}) });
}

export function requireActor(req: Request, res: Response): { uid: string; email?: string } | null {
  const actor = (req as Request & { user?: { uid: string; email?: string } }).user;
  if (actor) return actor;
  sendApiError(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  return null;
}
