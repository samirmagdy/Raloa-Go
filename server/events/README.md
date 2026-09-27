# Versioned domain events

Cross-domain workflows use the catalogued `Name.v1` event type instead of
calling another domain's service directly. Events carry a stable ID, aggregate
identity, occurrence time, version, and a bounded payload.

The current catalog includes `SitePublished`, `BookingCreated`,
`BookingCancelled`, `OrderPaid`, `OrderFulfilled`, `DomainVerified`,
`SubscriptionChanged`, `MediaUploaded`, `AnalyticsRecorded`, and
`IntegrationSynchronized`. Booking confirmation and order creation are also
represented explicitly.

Events are written through the transactional outbox and delivered to the
in-process event bus only after publication. Handlers enqueue durable jobs when
the workflow can be eventually consistent. Adding `v2` requires a new event
contract; existing `v1` consumers remain valid during migration.
