export type StorageAuthority = 'postgresql' | 'analytical_store' | 'firestore_exception' | 'migration_only';

export type StoragePolicy = {
  authority: StorageAuthority;
  realtimeRequired: boolean;
  transactionalWrites: boolean;
  rationale: string;
};

/** New transactional domains must be added here before a repository is implemented. */
export const STORAGE_POLICIES = {
  siteEditorConfiguration: {
    authority: 'firestore_exception',
    realtimeRequired: true,
    transactionalWrites: false,
    rationale: 'Document-shaped autosave and realtime Studio preview provide material value.'
  },
  realtimeCollaboration: {
    authority: 'firestore_exception',
    realtimeRequired: true,
    transactionalWrites: false,
    rationale: 'Presence, cursors, and ephemeral collaborative state benefit from realtime delivery.'
  },
  sites: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Ownership, handles, and publishing metadata require relational constraints.' },
  bookings: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Slot locking, overlap protection, attendees, and idempotency require transactions.' },
  products: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Variants, pricing, and inventory references are relational data.' },
  inventory: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Reservations, movements, and stock balances require row locks and history.' },
  orders: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Order, payment, fulfillment, and inventory state share a database boundary.' },
  subscriptions: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Provider event uniqueness and entitlement history require durable constraints.' },
  integrations: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Encrypted tokens, leases, scopes, and ownership require constrained persistence.' },
  domains: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Domain ownership and verification state must be unique and auditable.' },
  analytics: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Operational aggregates are relational; high-volume raw history belongs in analytical storage.' },
  analyticsRawEvents: { authority: 'analytical_store', realtimeRequired: false, transactionalWrites: false, rationale: 'High-volume append-only event history belongs in BigQuery or an equivalent warehouse.' },
  media: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Asset metadata and processing state are relational; bytes remain in object storage.' },
  backgroundJobs: { authority: 'postgresql', realtimeRequired: false, transactionalWrites: true, rationale: 'Claims, retries, leases, and dead letters need durable state.' }
} as const satisfies Record<string, StoragePolicy>;

export type StoragePolicyName = keyof typeof STORAGE_POLICIES;
