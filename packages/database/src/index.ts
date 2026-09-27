import type { EntityId, SiteId, TenantId, UnitOfWork } from '@raloa/domain';

export type RepositoryScope = { tenantId: TenantId; siteId?: SiteId };

export type Page<T> = { items: T[]; nextCursor?: string };

export type SiteRecord = { id: SiteId; tenantId: TenantId; handle: string; published: boolean };
export type BookingRecord = { id: EntityId; tenantId: TenantId; siteId: SiteId; startsAt: string; endsAt: string; status: string };
export type OrderRecord = { id: EntityId; tenantId: TenantId; siteId: SiteId; status: string; totalMinor: number };
export type ProductRecord = { id: EntityId; tenantId: TenantId; siteId: SiteId; active: boolean };

export interface SitesRepository {
  findById(scope: RepositoryScope, id: SiteId): Promise<SiteRecord | null>;
  findByHandle(handle: string): Promise<SiteRecord | null>;
  save(scope: RepositoryScope, site: SiteRecord): Promise<void>;
}

export interface BookingsRepository {
  findById(scope: RepositoryScope, id: EntityId): Promise<BookingRecord | null>;
  reserve(scope: RepositoryScope, booking: BookingRecord, idempotencyKey: string): Promise<BookingRecord>;
  updateStatus(scope: RepositoryScope, id: EntityId, status: string): Promise<void>;
}

export interface OrdersRepository {
  findById(scope: RepositoryScope, id: EntityId): Promise<OrderRecord | null>;
  save(scope: RepositoryScope, order: OrderRecord, idempotencyKey: string): Promise<void>;
  transition(scope: RepositoryScope, id: EntityId, from: string, to: string): Promise<void>;
}

export interface ProductsRepository {
  list(scope: RepositoryScope, cursor?: string): Promise<Page<ProductRecord>>;
  findById(scope: RepositoryScope, id: EntityId): Promise<ProductRecord | null>;
}

export interface TransactionManager extends UnitOfWork {}

export interface RepositoryBundle {
  sites: SitesRepository;
  bookings: BookingsRepository;
  orders: OrdersRepository;
  products: ProductsRepository;
  transaction: TransactionManager;
}

export type DatabaseProvider = 'postgres' | 'firestore';

export { createPostgresAuthDataSource } from './postgres-auth';
