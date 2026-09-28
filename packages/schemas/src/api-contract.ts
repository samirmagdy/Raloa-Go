import { z } from 'zod';

export const apiVersionSchema = z.literal('v1');
export const apiRequestIdSchema = z.string().min(1).max(200);
export const apiErrorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/);

export const apiErrorKindSchema = z.enum([
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'DEPENDENCY_FAILURE',
  'RATE_LIMITED',
  'INTERNAL_ERROR'
]);

export const validationFieldErrorsSchema = z.record(z.string().min(1).max(200), z.string().max(500));
export const apiErrorBodySchema = z.object({
  code: apiErrorCodeSchema,
  kind: apiErrorKindSchema.optional(),
  message: z.string().min(1).max(1_000),
  requestId: apiRequestIdSchema,
  fields: validationFieldErrorsSchema.optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const apiErrorEnvelopeSchema = z.object({ status: z.literal('error'), error: apiErrorBodySchema });
export const apiSuccessEnvelope = <T extends z.ZodType>(data: T) => z.object({ status: z.literal('ok'), data, requestId: apiRequestIdSchema });
export const apiAcceptedEnvelope = <T extends z.ZodType>(data: T) => z.object({ status: z.literal('accepted'), data, requestId: apiRequestIdSchema });

export const apiPaginationRequestSchema = z.object({ cursor: z.string().trim().min(1).max(512).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const apiPaginationResponseSchema = z.object({ nextCursor: z.string().max(512).nullable() });
export const apiIdempotencySchema = z.string().trim().min(16).max(200);
export const apiIdempotencyHeaderSchema = z.object({ idempotencyKey: apiIdempotencySchema });
export const apiRateLimitSchema = z.object({ limit: z.number().int().positive(), remaining: z.number().int().nonnegative(), resetAt: z.string().datetime(), retryAfterSeconds: z.number().int().positive().optional() });

export const apiContractSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().startsWith('/'),
  version: apiVersionSchema,
  authentication: z.enum(['public', 'authenticated', 'owner', 'internal']),
  authorization: z.string().min(1),
  request: z.object({ body: z.string().optional(), query: z.string().optional(), params: z.string().optional(), idempotency: z.enum(['required', 'optional', 'none']).default('none') }),
  response: z.object({ successStatus: z.array(z.number().int().min(200).max(299)).min(1), pagination: z.boolean().default(false) }),
  errors: z.array(z.object({ status: z.number().int().min(400).max(599), code: apiErrorCodeSchema })).min(1),
  rateLimit: z.object({ limit: z.number().int().positive(), windowSeconds: z.number().int().positive(), identity: z.enum(['ip', 'user', 'user_and_ip']) }).optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
export type ApiContract = z.infer<typeof apiContractSchema>;
