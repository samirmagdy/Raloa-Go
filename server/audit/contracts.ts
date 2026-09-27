export const AUDIT_ACTIONS = [
  'site.created', 'site.updated', 'site.published', 'site.unpublished', 'site.deleted',
  'domain.provisioned', 'domain.verified', 'domain.deleted',
  'billing.checkout_created', 'billing.portal_opened', 'billing.subscription_changed', 'billing.webhook_processed',
  'integration.connected', 'integration.disconnected',
  'order.transitioned', 'order.fulfillment_changed',
  'admin.changed'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditPrimitive = string | number | boolean | null;

export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  actorType: 'user' | 'system' | 'provider';
  tenantId: string | null;
  siteId: string | null;
  resourceType: string;
  resourceId: string;
  action: AuditAction;
  occurredAt: string;
  requestId?: string;
  traceId?: string;
  metadata: Record<string, AuditPrimitive>;
}

export interface AuditRecordInput {
  actorUserId?: string | null;
  actorType?: AuditEntry['actorType'];
  tenantId?: string | null;
  siteId?: string | null;
  resourceType: string;
  resourceId: string;
  action: AuditAction;
  occurredAt?: string;
  requestId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  list(resourceType: string, resourceId: string, limit?: number): Promise<AuditEntry[]>;
}

const SECRET_KEY = /(authorization|cookie|token|secret|password|credential|private.?key|raw.?payload|request.?body|access.?code|refresh)/i;
const MAX_METADATA_KEYS = 32;
const MAX_VALUE_LENGTH = 500;

export function safeAuditMetadata(input: Record<string, unknown> | undefined): Record<string, AuditPrimitive> {
  const output: Record<string, AuditPrimitive> = {};
  for (const [key, value] of Object.entries(input || {}).slice(0, MAX_METADATA_KEYS)) {
    if (SECRET_KEY.test(key)) continue;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') output[key] = value;
    else if (typeof value === 'string') output[key] = value.slice(0, MAX_VALUE_LENGTH);
  }
  return output;
}

