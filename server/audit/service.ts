import crypto from 'node:crypto';
import { AuditEntry, AuditRecordInput, AuditRepository, safeAuditMetadata } from './contracts';

export function createAuditService(repository: AuditRepository, clock: () => Date = () => new Date()) {
  return {
    async record(input: AuditRecordInput): Promise<AuditEntry> {
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType || (input.actorUserId ? 'user' : 'system'),
        tenantId: input.tenantId ?? null,
        siteId: input.siteId ?? null,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
        occurredAt: input.occurredAt || clock().toISOString(),
        ...(input.requestId ? { requestId: input.requestId } : {}),
        ...(input.traceId ? { traceId: input.traceId } : {}),
        metadata: safeAuditMetadata(input.metadata)
      };
      await repository.append(entry);
      return entry;
    },
    async recordBestEffort(input: AuditRecordInput): Promise<void> {
      try { await this.record(input); } catch (error) { console.error('[Audit logging]', error); }
    }
  };
}

export type AuditService = ReturnType<typeof createAuditService>;

