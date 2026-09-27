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

export type TenantScope = z.infer<typeof tenantScopeSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;
export type BookingCreate = z.infer<typeof bookingCreateSchema>;
export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;

