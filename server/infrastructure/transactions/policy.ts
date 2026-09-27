export type Consistency = 'strong' | 'eventual';
export type ExternalCallBoundary = 'inside_transaction' | 'after_commit' | 'before_transaction' | 'separate_workflow';

export type TransactionPolicy = {
  consistency: Consistency;
  databaseBoundary: 'single_transaction' | 'claim_then_transaction' | 'separate_transactions';
  externalCalls: ExternalCallBoundary;
  idempotencyRequired: boolean;
  outboxRequired: boolean;
  notes: string;
};

/**
 * The consistency contract for application services.
 *
 * This is intentionally provider-neutral: Firestore repositories satisfy the
 * same boundary with runTransaction while PostgreSQL repositories use BEGIN,
 * row locks, constraints, and commit. Provider calls never participate in a
 * database transaction.
 */
export const TRANSACTION_POLICIES = {
  bookingReservation: {
    consistency: 'strong',
    databaseBoundary: 'single_transaction',
    externalCalls: 'after_commit',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Lock every requested slot, verify capacity, write booking/attendees, and enqueue follow-up work atomically.'
  },
  inventoryReservation: {
    consistency: 'strong',
    databaseBoundary: 'single_transaction',
    externalCalls: 'after_commit',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Lock inventory, create the reservation and movement, and create the pending order atomically.'
  },
  paymentReconciliation: {
    consistency: 'strong',
    databaseBoundary: 'claim_then_transaction',
    externalCalls: 'before_transaction',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Claim the provider event, then atomically apply payment, order, inventory, and event state.'
  },
  subscriptionUpdate: {
    consistency: 'strong',
    databaseBoundary: 'claim_then_transaction',
    externalCalls: 'before_transaction',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Claim the provider event and atomically upsert subscription state, history, and entitlements.'
  },
  slugUniqueness: {
    consistency: 'strong',
    databaseBoundary: 'single_transaction',
    externalCalls: 'after_commit',
    idempotencyRequired: true,
    outboxRequired: false,
    notes: 'Reserve the normalized slug and ownership mapping together; the database unique constraint is authoritative.'
  },
  fulfillment: {
    consistency: 'strong',
    databaseBoundary: 'single_transaction',
    externalCalls: 'after_commit',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Validate the order transition and atomically write history, inventory movements, and fulfillment events.'
  },
  oauthTokenRefresh: {
    consistency: 'strong',
    databaseBoundary: 'separate_transactions',
    externalCalls: 'separate_workflow',
    idempotencyRequired: true,
    outboxRequired: false,
    notes: 'Lease/lock the credential row, refresh outside the transaction, then conditionally persist rotated tokens.'
  },
  calendarSync: {
    consistency: 'eventual',
    databaseBoundary: 'separate_transactions',
    externalCalls: 'separate_workflow',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Use an outbox job and provider event IDs; retries must converge calendar_sync_state.'
  },
  emailDelivery: {
    consistency: 'eventual',
    databaseBoundary: 'separate_transactions',
    externalCalls: 'separate_workflow',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Persist delivery intent before sending and record retry/dead-letter state after the provider call.'
  },
  analyticsRollup: {
    consistency: 'eventual',
    databaseBoundary: 'separate_transactions',
    externalCalls: 'after_commit',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Never hold a booking, order, or payment transaction open for analytics aggregation.'
  },
  domainVerification: {
    consistency: 'eventual',
    databaseBoundary: 'separate_transactions',
    externalCalls: 'separate_workflow',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Persist verification intent, perform DNS/provider checks in a worker, and reconcile status.'
  },
  mediaProcessing: {
    consistency: 'eventual',
    databaseBoundary: 'separate_transactions',
    externalCalls: 'separate_workflow',
    idempotencyRequired: true,
    outboxRequired: true,
    notes: 'Persist upload metadata first; processing and cleanup are durable, retryable jobs.'
  }
} as const satisfies Record<string, TransactionPolicy>;

export type TransactionPolicyName = keyof typeof TRANSACTION_POLICIES;
