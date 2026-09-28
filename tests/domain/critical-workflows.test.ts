import { describe, expect, it } from 'vitest';
import { createVersionedDomainEvent } from '../../server/events/contracts';
import { assertOrderTransition } from '../../server/domains/orders/state-machine';

type Step = { name: string; event?: ReturnType<typeof createVersionedDomainEvent> };
function workflow() { const steps: Step[] = []; return { steps, record: (name: string, event?: Step['event']) => steps.push({ name, event }) }; }

describe('critical workflow contracts', () => {
  it('covers creator authentication through publish, public visit, and analytics', () => {
    const flow = workflow();
    flow.record('creator.authenticated'); flow.record('site.created'); flow.record('site.edited');
    flow.record('media.uploaded', createVersionedDomainEvent({ id: 'media-event', name: 'MediaUploaded', aggregateType: 'media', aggregateId: 'media-1', payload: { mediaId: 'media-1', siteId: 'site-1' } }));
    flow.record('site.published', createVersionedDomainEvent({ id: 'publish-event', name: 'SitePublished', aggregateType: 'site', aggregateId: 'site-1', payload: { siteId: 'site-1', handle: 'creator', publicationVersion: 1 } }));
    flow.record('visitor.visited');
    flow.record('analytics.recorded');
    expect(flow.steps.map((step) => step.name)).toEqual(['creator.authenticated', 'site.created', 'site.edited', 'media.uploaded', 'site.published', 'visitor.visited', 'analytics.recorded']);
    expect(flow.steps[4].event?.type).toBe('SitePublished.v1');
  });

  it('covers booking reservation through notification, calendar sync, and confirmation', () => {
    const flow = workflow();
    flow.record('visitor.booking.requested');
    flow.record('booking.slot.reserved', createVersionedDomainEvent({ id: 'booking-event', name: 'BookingCreated', aggregateType: 'booking', aggregateId: 'booking-1', payload: { bookingId: 'booking-1', siteId: 'site-1', hostUserId: 'user-1', slotStart: '2026-01-01T10:00:00.000Z' } }));
    flow.record('notification.enqueued'); flow.record('calendar.event.created');
    flow.record('creator.booking.confirmed');
    expect(flow.steps.map((step) => step.name)).toEqual(['visitor.booking.requested', 'booking.slot.reserved', 'notification.enqueued', 'calendar.event.created', 'creator.booking.confirmed']);
    expect(flow.steps[1].event?.type).toBe('BookingCreated.v1');
  });

  it('covers checkout through Stripe, webhook, inventory, order, and fulfillment', () => {
    const flow = workflow();
    flow.record('product.selected');
    flow.record('inventory.reserved', createVersionedDomainEvent({ id: 'order-created', name: 'OrderCreated', aggregateType: 'order', aggregateId: 'order-1', payload: { orderId: 'order-1', siteId: 'site-1', productId: 'product-1', creatorId: 'user-1', quantity: 1 } }));
    flow.record('stripe.checkout.created');
    flow.record('stripe.webhook.accepted', createVersionedDomainEvent({ id: 'order-paid', name: 'OrderPaid', aggregateType: 'order', aggregateId: 'order-1', payload: { orderId: 'order-1', siteId: 'site-1', paymentReference: 'evt-1' } }));
    assertOrderTransition('pending', 'paid'); flow.record('order.paid'); flow.record('inventory.committed');
    assertOrderTransition('paid', 'processing'); flow.record('order.processing');
    assertOrderTransition('processing', 'fulfilled');
    flow.record('order.fulfilled', createVersionedDomainEvent({ id: 'order-fulfilled', name: 'OrderFulfilled', aggregateType: 'order', aggregateId: 'order-1', payload: { orderId: 'order-1', siteId: 'site-1' } }));
    expect(flow.steps.map((step) => step.name)).toEqual(['product.selected', 'inventory.reserved', 'stripe.checkout.created', 'stripe.webhook.accepted', 'order.paid', 'inventory.committed', 'order.processing', 'order.fulfilled']);
    expect(flow.steps[3].event?.type).toBe('OrderPaid.v1');
    expect(flow.steps[7].event?.type).toBe('OrderFulfilled.v1');
  });
});
