import { z } from 'zod';
export { apiAcceptedEnvelope, apiContractSchema, apiErrorBodySchema, apiErrorEnvelopeSchema, apiIdempotencyHeaderSchema, apiIdempotencySchema, apiPaginationRequestSchema, apiPaginationResponseSchema, apiRateLimitSchema, apiSuccessEnvelope } from '@raloa/schemas';

export const API_VERSION = 'v1' as const;
export const apiErrorSchema = z.object({ status: z.literal('error'), error: z.string(), code: z.string(), message: z.string(), fields: z.record(z.string(), z.string()).optional() });
export const paginationQuerySchema = z.object({ cursor: z.string().max(512).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const idempotencyKeySchema = z.string().trim().min(16).max(200);
export const publicSiteResponseSchema = z.object({ site: z.record(z.string(), z.unknown()) });
export const apiSuccessSchema = <T extends z.ZodType>(data: T) => z.object({ status: z.literal('ok').default('ok'), data });
export const apiListResponseSchema = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable().optional() });

export const publicProfileResponseSchemaV1 = z.object({ site: z.record(z.string(), z.unknown()), profile: z.record(z.string(), z.unknown()).optional() }).passthrough();
export const publicBookingResponseSchemaV1 = z.object({ bookingId: z.string(), status: z.enum(['pending', 'confirmed', 'cancelled']).optional() }).passthrough();
export const productListResponseSchemaV1 = z.object({ items: z.array(z.record(z.string(), z.unknown())), nextCursor: z.string().nullable().optional() });
export const apiRequestSchemasV1 = {
  pagination: paginationQuerySchema,
  idempotency: z.object({ idempotencyKey: idempotencyKeySchema }),
  publicProfile: z.object({ handle: z.string().regex(/^[a-z0-9_-]{3,30}$/) }),
  publicBooking: z.object({
    hostHandle: z.string().regex(/^[a-z0-9_-]{3,30}$/),
    serviceId: z.string().regex(/^[a-z0-9_-]{1,64}$/),
    slotStart: z.string().datetime(), slotEnd: z.string().datetime(),
    customerName: z.string().trim().min(1).max(120), customerEmail: z.string().email().max(320), notes: z.string().max(2000).optional()
  })
} as const;
export const apiResponseSchemasV1 = {
  error: apiErrorSchema,
  publicProfile: publicProfileResponseSchemaV1,
  publicBooking: publicBookingResponseSchemaV1,
  products: productListResponseSchemaV1
} as const;

export type AuthRequirement = 'public' | 'authenticated' | 'owner' | 'internal';
export interface ApiEndpointContract {
  version: typeof API_VERSION;
  auth: AuthRequirement;
  authorization: string;
  pagination?: 'cursor';
  idempotency?: 'required' | 'optional' | 'none';
  rateLimit?: { limit: number; windowSeconds: number; identity: 'ip' | 'user' | 'user_and_ip' };
}

export const API_CONTRACTS = {
  publicSite: { version: API_VERSION, auth: 'public', authorization: 'published site or verified custom domain', idempotency: 'none', rateLimit: { limit: 120, windowSeconds: 60, identity: 'ip' } },
  publicBooking: { version: API_VERSION, auth: 'public', authorization: 'published site booking configuration', idempotency: 'required', rateLimit: { limit: 10, windowSeconds: 3600, identity: 'ip' } },
  publicTelemetry: { version: API_VERSION, auth: 'public', authorization: 'published site and validated target', idempotency: 'optional', rateLimit: { limit: 120, windowSeconds: 3600, identity: 'ip' } },
  creatorSites: { version: API_VERSION, auth: 'owner', authorization: 'authenticated user owns the site', pagination: 'cursor', idempotency: 'optional' },
  creatorBookings: { version: API_VERSION, auth: 'owner', authorization: 'authenticated user owns the site and booking', pagination: 'cursor', idempotency: 'none' },
  creatorOrders: { version: API_VERSION, auth: 'owner', authorization: 'authenticated user owns the order/site', pagination: 'cursor', idempotency: 'none' },
  internalWorker: { version: API_VERSION, auth: 'internal', authorization: 'BACKGROUND_JOB_SECRET or provider identity', idempotency: 'required' }
} as const satisfies Record<string, ApiEndpointContract>;
