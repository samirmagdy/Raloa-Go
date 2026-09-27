import { AuditEntry, AuditRepository } from './contracts';

export class InMemoryAuditRepository implements AuditRepository {
  readonly entries: AuditEntry[] = [];
  async append(entry: AuditEntry): Promise<void> { this.entries.push(structuredClone(entry)); }
  async list(resourceType: string, resourceId: string, limit = 100): Promise<AuditEntry[]> {
    return this.entries.filter((entry) => entry.resourceType === resourceType && entry.resourceId === resourceId).slice(-limit).reverse();
  }
}

