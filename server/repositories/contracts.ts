export interface SiteRecord { id?: string; userId?: string; username?: string; isPublished?: boolean; [key: string]: unknown }
export interface BookingRecord { id?: string; hostUserId?: string; siteId?: string; [key: string]: unknown }
export interface OrderRecord { id?: string; creatorId?: string; customerEmail?: string; productId?: string; [key: string]: unknown }
export interface OrderTransitionRecord { orderId: string; from: string | null; to: string; transitionKey: string; source: string; actorUserId?: string; metadata?: Record<string, unknown> }
export interface InventoryRecord { id?: string; productId: string; available: number; reserved: number; [key: string]: unknown }
export interface SubscriptionRecord { id?: string; userId: string; plan: string; status: string; [key: string]: unknown }
import type { AuthoritativeBillingState } from '../../server-services';

export type BillingStateRecord = AuthoritativeBillingState & { accountId: string };
export interface IntegrationRecord { id?: string; userId: string; provider: string; [key: string]: unknown }
export interface AudienceRecord { id?: string; userId?: string; siteId?: string; email?: string; [key: string]: unknown }
export interface AnalyticsRollup { id?: string; siteOwnerId: string; siteId: string; date: string; [key: string]: unknown }

export interface SitesRepository {
  getOwned(userId: string, siteId: string): Promise<SiteRecord | null>;
  listOwned(userId: string, limit?: number): Promise<SiteRecord[]>;
  findPublishedByHandle(handle: string, siteId?: string): Promise<SiteRecord | null>;
  save(siteId: string, site: SiteRecord): Promise<void>;
  remove(userId: string, siteId: string): Promise<void>;
}

export interface BookingsRepository {
  get(bookingId: string): Promise<BookingRecord | null>;
  listForHost(hostUserId: string, siteId?: string, limit?: number): Promise<BookingRecord[]>;
  create(bookingId: string, booking: BookingRecord): Promise<void>;
  update(bookingId: string, changes: Partial<BookingRecord>): Promise<void>;
}

export interface OrdersRepository {
  get(orderId: string): Promise<OrderRecord | null>;
  listByCreator(creatorId: string, limit?: number): Promise<OrderRecord[]>;
  listByCustomer(email: string, limit?: number): Promise<OrderRecord[]>;
  save(orderId: string, order: Partial<OrderRecord>): Promise<void>;
  transition(orderId: string, transition: OrderTransitionRecord): Promise<OrderRecord>;
}

export interface InventoryRepository {
  getByProduct(productId: string): Promise<InventoryRecord | null>;
  reserve(productId: string, quantity: number): Promise<void>;
  release(productId: string, quantity: number): Promise<void>;
  decrement(productId: string, quantity: number): Promise<void>;
}

export interface SubscriptionsRepository {
  getByUser(userId: string): Promise<SubscriptionRecord | null>;
  save(userId: string, subscription: Partial<SubscriptionRecord>): Promise<void>;
}

export interface IntegrationsRepository {
  listForUser(userId: string): Promise<IntegrationRecord[]>;
  get(userId: string, provider: string): Promise<IntegrationRecord | null>;
  save(userId: string, provider: string, integration: IntegrationRecord): Promise<void>;
  remove(userId: string, provider: string): Promise<void>;
}

export interface AudienceRepository {
  list(userId: string, siteId?: string, limit?: number): Promise<AudienceRecord[]>;
  get(kind: 'subscriber' | 'submission', id: string): Promise<AudienceRecord | null>;
  save(kind: 'subscriber' | 'submission', id: string, record: AudienceRecord): Promise<void>;
  remove(kind: 'subscriber' | 'submission', id: string): Promise<void>;
}

export interface AnalyticsRollupsRepository {
  saveRollup(key: string, rollup: AnalyticsRollup): Promise<void>;
  listRollups(siteOwnerId: string, siteId?: string, fromDate?: string, toDate?: string): Promise<AnalyticsRollup[]>;
  listVisitorDays(siteOwnerId: string, siteId?: string, fromDate?: string, toDate?: string): Promise<AnalyticsRollup[]>;
}

export interface BillingRepository {
  getAuthoritativeState(accountId: string): Promise<BillingStateRecord | null>;
  saveAuthoritativeState(accountId: string, state: BillingStateRecord): Promise<void>;
}

export interface DomainsRepository {
  get(domainId: string): Promise<Record<string, unknown> | null>;
  findByHostname(hostname: string): Promise<Record<string, unknown> | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Record<string, unknown> | null>;
  listOwned(ownerUserId: string): Promise<Record<string, unknown>[]>;
  save(domainId: string, domain: Record<string, unknown>): Promise<void>;
  remove(domainId: string): Promise<void>;
}
