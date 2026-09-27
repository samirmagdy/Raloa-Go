import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const bookingStatus = pgEnum('booking_status', ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']);
export const orderStatus = pgEnum('order_status', ['pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded']);
export const orderState = pgEnum('order_state', ['pending', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded', 'payment_failed']);
export const jobStatus = text('status');

export const appUsers = pgTable('app_users', {
  id: uuid('id').defaultRandom().primaryKey(), externalAuthId: text('external_auth_id').notNull().unique(), email: text('email'), displayName: text('display_name'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const sites = pgTable('sites', {
  id: uuid('id').defaultRandom().primaryKey(), ownerUserId: uuid('owner_user_id').notNull().references(() => appUsers.id), handle: text('handle').notNull().unique(), displayName: text('display_name').notNull(), content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}), isPublished: boolean('is_published').notNull().default(false), publishedAt: timestamp('published_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ publishedHandleIndex: index('sites_published_handle_idx').on(table.handle), ownerUpdatedIndex: index('sites_owner_updated_idx').on(table.ownerUserId, table.updatedAt) }));

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(), siteId: uuid('site_id').notNull().references(() => sites.id), hostUserId: uuid('host_user_id').notNull().references(() => appUsers.id), serviceId: uuid('service_id').notNull(), slotId: uuid('slot_id'), customerName: text('customer_name').notNull(), customerEmail: text('customer_email').notNull(), startsAt: timestamp('starts_at', { withTimezone: true }).notNull(), endsAt: timestamp('ends_at', { withTimezone: true }).notNull(), timezone: text('timezone').notNull(), status: bookingStatus('status').default('pending').notNull(), externalEventId: text('external_event_id'), notes: text('notes'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ hostCreatedIndex: index('bookings_host_created_idx').on(table.hostUserId, table.createdAt, table.id), siteTimeIndex: index('bookings_site_time_idx').on(table.siteId, table.startsAt, table.endsAt) }));

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(), creatorUserId: uuid('creator_user_id').notNull().references(() => appUsers.id), siteId: uuid('site_id').notNull().references(() => sites.id), customerEmail: text('customer_email').notNull(), status: orderStatus('status').default('pending_payment').notNull(), state: orderState('state').default('pending').notNull(), fulfillmentStatus: text('fulfillment_status').notNull().default('unfulfilled'), providerCheckoutId: text('provider_checkout_id').unique(), totalMinor: integer('total_minor').notNull(), currency: text('currency').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ creatorCreatedIndex: index('orders_creator_created_idx').on(table.creatorUserId, table.createdAt, table.id) }));

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(), eventType: text('event_type').notNull(), aggregateType: text('aggregate_type').notNull(), aggregateId: uuid('aggregate_id').notNull(), idempotencyKey: text('idempotency_key').notNull(), payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}), status: text('status').notNull().default('pending'), attempts: integer('attempts').notNull().default(0), maxAttempts: integer('max_attempts').notNull().default(8), availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(), leaseUntil: timestamp('lease_until', { withTimezone: true }), lastError: text('last_error'), publishedAt: timestamp('published_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ idempotencyIndex: uniqueIndex('outbox_events_idempotency_idx').on(table.idempotencyKey), claimIndex: index('outbox_events_claim_idx').on(table.status, table.availableAt, table.createdAt) }));
