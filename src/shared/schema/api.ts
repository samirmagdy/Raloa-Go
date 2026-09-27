import { z } from 'zod';

export const API_VERSION = 'v1' as const;
export const apiErrorSchema = z.object({ status: z.literal('error'), error: z.string(), code: z.string(), message: z.string(), fields: z.record(z.string(), z.string()).optional() });
export const paginationQuerySchema = z.object({ cursor: z.string().max(512).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const idempotencyKeySchema = z.string().trim().min(16).max(200);
export const publicSiteResponseSchema = z.object({ site: z.record(z.string(), z.unknown()) });

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
