import type { NextFunction, Request, Response } from 'express';
import { apiErrorEnvelopeSchema } from '@raloa/schemas';

export type ApplicationErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | string;

export interface ApplicationErrorOptions {
  code: ApplicationErrorCode;
  message: string;
  statusCode?: number;
  fields?: Record<string, string>;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly statusCode: number;
  readonly fields?: Record<string, string>;
  readonly details?: Record<string, unknown>;

  constructor(options: ApplicationErrorOptions) {
    super(options.message);
    this.name = 'ApplicationError';
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.fields = options.fields;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = 'Validation failed', fields?: Record<string, string>, code: ApplicationErrorCode = 'VALIDATION_ERROR') {
    super({
      code,
      message,
      statusCode: 400,
      fields
    });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication required', code: ApplicationErrorCode = 'AUTHENTICATION_REQUIRED') {
    super({
      code,
      message,
      statusCode: 401
    });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = 'Permission denied', code: ApplicationErrorCode = 'FORBIDDEN', details?: Record<string, unknown>) {
    super({
      code,
      message,
      statusCode: 403,
      details
    });
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = 'Resource not found', code: ApplicationErrorCode = 'NOT_FOUND') {
    super({
      code,
      message,
      statusCode: 404
    });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = 'Resource conflict', code: ApplicationErrorCode = 'CONFLICT', details?: Record<string, unknown>) {
    super({
      code,
      message,
      statusCode: 409,
      details
    });
    this.name = 'ConflictError';
  }
}

export class DependencyUnavailableError extends ApplicationError {
  constructor(message = 'Service temporarily unavailable', code: ApplicationErrorCode = 'DEPENDENCY_UNAVAILABLE') {
    super({
      code,
      message,
      statusCode: 503
    });
    this.name = 'DependencyUnavailableError';
  }
}

export class RateLimitError extends ApplicationError {
  readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number, code: ApplicationErrorCode = 'RATE_LIMIT_EXCEEDED') {
    super({
      code,
      message,
      statusCode: 429,
      details: retryAfter !== undefined ? { retryAfter } : undefined
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class InternalError extends ApplicationError {
  constructor(message = 'Internal server error', code: ApplicationErrorCode = 'INTERNAL_ERROR', cause?: unknown) {
    super({
      code,
      message,
      statusCode: 500,
      cause
    });
    this.name = 'InternalError';
  }
}

/**
 * Maps known error conditions or converts unknown exceptions into standardized ApplicationError
 */
export function normalizeApplicationError(err: unknown): ApplicationError {
  if (err instanceof ApplicationError) {
    return err;
  }

  if (err && typeof err === 'object') {
    const errorObj = err as Record<string, any>;

    // Zod validation errors
    if (Array.isArray(errorObj.issues)) {
      const fields: Record<string, string> = {};
      for (const issue of errorObj.issues) {
        const path = Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || 'field');
        fields[path] = issue.message;
      }
      return new ValidationError('Validation failed', fields);
    }

    const message = typeof errorObj.message === 'string' ? errorObj.message : 'Internal error';

    // Standard business rule strings used across the codebase
    switch (message) {
      case 'AUTH_REQUIRED':
      case 'AUTHENTICATION_REQUIRED':
        return new AuthenticationError('Authentication required.', 'AUTH_REQUIRED');
      case 'FORBIDDEN':
      case 'ENTITLEMENT_REQUIRED':
        return new AuthorizationError(message, 'FORBIDDEN');
      case 'NOT_FOUND':
      case 'RESOURCE_NOT_FOUND':
      case 'SITE_NOT_FOUND':
      case 'PROFILE_NOT_FOUND':
      case 'BOOKING_NOT_FOUND':
        return new NotFoundError('Resource not found.', message);
      case 'CONFLICT':
      case 'SITE_EXISTS':
      case 'HANDLE_IN_USE':
      case 'SLOT_UNAVAILABLE':
      case 'BOOKING_SLOT_TAKEN':
      case 'SITE_VERSION_CONFLICT':
      case 'STRIPE_SUBSCRIPTION_EXISTS':
        return new ConflictError(message, message);
      case 'SERVICE_NOT_CONFIGURED':
      case 'DEPENDENCY_UNAVAILABLE':
        return new DependencyUnavailableError('Service is temporarily unavailable.', message);
      case 'RATE_LIMIT_EXCEEDED':
      case 'RATE_LIMITED':
        return new RateLimitError('Rate limit exceeded', undefined, 'RATE_LIMIT_EXCEEDED');
      default:
        break;
    }

    if (errorObj.code === 'LIMIT_FILE_SIZE') {
      return new ValidationError('The uploaded file is larger than the maximum allowed size.', undefined, 'MEDIA_TOO_LARGE');
    }
  }

  const rawMessage = err instanceof Error ? err.message : String(err || 'Unknown error');
  return new InternalError(rawMessage, 'INTERNAL_ERROR', err);
}

/**
 * Standard centralized error response builder
 */
export function formatErrorResponse(res: Response, error: ApplicationError) {
  const requestId = String(res.getHeader('X-Request-ID') || 'unknown');
  const kind = error.statusCode === 400 ? 'VALIDATION_ERROR' : error.statusCode === 401 ? 'AUTHENTICATION_ERROR' : error.statusCode === 403 ? 'AUTHORIZATION_ERROR' : error.statusCode === 404 ? 'NOT_FOUND' : error.statusCode === 409 ? 'CONFLICT' : error.statusCode === 429 ? 'RATE_LIMITED' : error.statusCode >= 500 ? (error.statusCode === 503 ? 'DEPENDENCY_FAILURE' : 'INTERNAL_ERROR') : undefined;
  const canonical = apiErrorEnvelopeSchema.parse({ status: 'error', error: { code: error.code, kind, message: error.message, requestId, ...(error.fields ? { fields: error.fields } : {}), ...(error.details ? { details: error.details } : {}) } });
  const body = { ...canonical, code: error.code, message: error.message, errorCode: error.code };

  if (error instanceof RateLimitError && error.retryAfter !== undefined) {
    res.setHeader('Retry-After', String(error.retryAfter));
  }

  return res.status(error.statusCode).json(body);
}
