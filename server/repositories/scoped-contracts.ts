import type { TenantScope } from '../core/tenant-scope';
import type { AnalyticsRollup, BookingRecord, InventoryRecord, OrderRecord, SiteRecord } from './contracts';

/** Repository ports for new code: every site-scoped lookup starts with TenantScope. */
export interface TenantSitesRepository {
  get(scope: TenantScope, siteId: string): Promise<SiteRecord | null>;
  list(scope: TenantScope, limit?: number): Promise<SiteRecord[]>;
  save(scope: TenantScope, siteId: string, site: SiteRecord): Promise<void>;
}

export interface TenantBookingsRepository {
  get(scope: TenantScope, bookingId: string): Promise<BookingRecord | null>;
  list(scope: TenantScope, limit?: number): Promise<BookingRecord[]>;
  create(scope: TenantScope, bookingId: string, booking: BookingRecord): Promise<void>;
  update(scope: TenantScope, bookingId: string, changes: Partial<BookingRecord>): Promise<void>;
}

export interface TenantOrdersRepository {
  get(scope: TenantScope, orderId: string): Promise<OrderRecord | null>;
  list(scope: TenantScope, limit?: number): Promise<OrderRecord[]>;
  save(scope: TenantScope, orderId: string, order: Partial<OrderRecord>): Promise<void>;
}

export interface TenantInventoryRepository {
  get(scope: TenantScope, variantId: string): Promise<InventoryRecord | null>;
  reserve(scope: TenantScope, variantId: string, quantity: number): Promise<void>;
  release(scope: TenantScope, variantId: string, quantity: number): Promise<void>;
}

export interface TenantAnalyticsRepository {
  listRollups(scope: TenantScope, fromDate?: string, toDate?: string, limit?: number): Promise<AnalyticsRollup[]>;
}
