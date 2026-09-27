export const DOMAIN_EVENTS = {
  SitePublished: 'SitePublished',
  BookingCreated: 'BookingCreated',
  BookingConfirmed: 'BookingConfirmed',
  BookingCancelled: 'BookingCancelled',
  OrderCreated: 'OrderCreated',
  OrderPaid: 'OrderPaid',
  OrderFulfilled: 'OrderFulfilled',
  DomainVerified: 'DomainVerified',
  SubscriptionChanged: 'SubscriptionChanged',
  MediaUploaded: 'MediaUploaded',
  AnalyticsRecorded: 'AnalyticsRecorded',
  IntegrationSynchronized: 'IntegrationSynchronized'
} as const;

export type DomainEventName = typeof DOMAIN_EVENTS[keyof typeof DOMAIN_EVENTS];
export type DomainEventType = `${DomainEventName}.v1`;

export function eventType(name: DomainEventName, version = 1): DomainEventType {
  if (version !== 1) throw new Error('UNSUPPORTED_DOMAIN_EVENT_VERSION');
  return `${name}.v1` as DomainEventType;
}
