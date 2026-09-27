# Repository ports

The interfaces in `contracts.ts` are the persistence boundary consumed by application services.
They describe domain intents rather than Firestore queries:

- `SitesRepository`
- `BookingsRepository`
- `OrdersRepository`
- `InventoryRepository`
- `SubscriptionsRepository`
- `BillingRepository`
- `IntegrationsRepository`
- `DomainsRepository`
- `AudienceRepository`
- `AnalyticsRollupsRepository`
- `MediaMetadataRepository` (defined by the media domain contract)

`firestore.ts` is the initial adapter. A PostgreSQL implementation only needs to satisfy the same
interfaces and can be selected in `server/modules.ts`; controllers, services, HTTP contracts, and
provider adapters do not need to change.

Services receive these repository ports; Firestore query and document details remain confined to
`firestore.ts`, allowing PostgreSQL adapters to be introduced without rewriting business logic.
