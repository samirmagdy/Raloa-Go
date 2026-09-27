# Repository ports

The interfaces in `contracts.ts` are the persistence boundary consumed by application services.
They describe domain intents rather than Firestore queries:

- `SitesRepository`
- `BookingsRepository`
- `OrdersRepository`
- `InventoryRepository`
- `SubscriptionsRepository`
- `IntegrationsRepository`
- `AudienceRepository`
- `AnalyticsRollupsRepository`

`firestore.ts` is the initial adapter. A PostgreSQL implementation only needs to satisfy the same
interfaces and can be selected in `server/modules.ts`; controllers, services, HTTP contracts, and
provider adapters do not need to change.
