import assert from 'node:assert/strict';
import { createVersionedDomainEvent } from './server/events';
import { domainEventPayloadSchemasV1, domainEventSchemaV1 } from './src/shared/schema';

const payloads = {
  SitePublished: { siteId: 'site-1', handle: 'creator' },
  BookingCreated: { bookingId: 'booking-1', hostUserId: 'user-1', siteId: 'site-1' },
  BookingCancelled: { bookingId: 'booking-1', siteId: 'site-1' },
  OrderCreated: { orderId: 'order-1', productId: 'product-1', siteId: 'site-1', creatorId: 'user-1' },
  OrderPaid: { orderId: 'order-1', siteId: 'site-1' },
  OrderFulfilled: { orderId: 'order-1', siteId: 'site-1' },
  SubscriptionChanged: { accountId: 'account-1', plan: 'pro', status: 'active' },
  DomainVerified: { domainId: 'domain-1', hostname: 'example.test', sslStatus: 'active' },
  MediaUploaded: { mediaId: 'media-1', siteId: 'site-1', lifecycle: 'uploaded' as const },
  IntegrationDisconnected: { connectionId: 'connection-1', provider: 'google' }
} as const;

for (const [name, payload] of Object.entries(payloads) as Array<[keyof typeof domainEventPayloadSchemasV1, Record<string, unknown>]>) {
  const event = createVersionedDomainEvent({ id: `event-${name}`, name, aggregateType: name.toLowerCase(), aggregateId: 'aggregate-1', payload });
  assert.equal(event.type, `${name}.v1`);
  assert.equal(domainEventSchemaV1.safeParse(event).success, true);
}

assert.throws(() => createVersionedDomainEvent({ id: 'invalid', name: 'OrderPaid', aggregateType: 'order', aggregateId: 'order-1', payload: { siteId: 'site-1' } }), /invalid|expected|required/i);
console.log('Versioned domain event contract tests passed');
