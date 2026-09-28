import { z } from 'zod';

export const schemaVersion = z.literal(1);
export const tenantScopeSchema = z.object({ tenantId: z.string().min(1), siteId: z.string().min(1).optional() });
export const paginationSchema = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const idempotencySchema = z.object({ idempotencyKey: z.string().trim().min(16).max(300) });
export const errorResponseSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }) });
export const domainEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9]*\.v1$/),
  version: z.literal(1),
  aggregateType: z.string().min(1),
  aggregateId: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export const bookingCreateSchema = z.object({
  siteId: z.string().min(1),
  serviceId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  idempotencyKey: idempotencySchema.shape.idempotencyKey,
});

export const jobEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  idempotencyKey: z.string().min(1),
  attempt: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
});

const publicAssetSchema = z.string().max(2_000).default('');

/** The only shape consumed by the public renderer. It is deliberately detached from Studio models. */
export const publicSiteSnapshotSchema = z.object({
  siteId: z.string().min(1),
  handle: z.string().regex(/^[a-z0-9][a-z0-9-._-]{0,63}$/i),
  displayName: z.string().trim().min(1).max(160),
  role: z.string().max(160).default(''),
  bio: z.string().max(4_000).default(''),
  bioAr: z.string().max(4_000).default(''),
  avatar: publicAssetSchema,
  coverImage: publicAssetSchema,
  metaTitle: z.string().max(160).optional(),
  metaDescription: z.string().max(320).optional(),
  locale: z.enum(['en', 'ar']).default('en'),
  publicationVersion: z.number().int().positive(),
  isPublished: z.literal(true),
  designTokens: z.record(z.string(), z.unknown()).default({}),
  links: z.array(z.record(z.string(), z.unknown())).default([]),
  socials: z.array(z.record(z.string(), z.unknown())).default([]),
  blocks: z.array(z.record(z.string(), z.unknown())).default([]),
}).passthrough();

export type TenantScope = z.infer<typeof tenantScopeSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;
export type BookingCreate = z.infer<typeof bookingCreateSchema>;
export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;
export type PublicSiteSnapshot = z.infer<typeof publicSiteSnapshotSchema>;

export * from './api-contract';
