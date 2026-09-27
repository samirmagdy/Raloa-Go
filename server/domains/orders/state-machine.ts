export type OrderState = 'pending' | 'paid' | 'processing' | 'fulfilled' | 'cancelled' | 'refunded' | 'payment_failed';
export type OrderTransitionSource = 'api' | 'stripe_webhook' | 'worker' | 'migration';

const TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  pending: ['paid', 'payment_failed', 'cancelled'],
  payment_failed: ['pending', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['fulfilled', 'cancelled', 'refunded'],
  fulfilled: ['refunded'],
  cancelled: [],
  refunded: []
};

export interface OrderTransition {
  orderId: string;
  from: OrderState;
  to: OrderState;
  transitionKey: string;
  source: OrderTransitionSource;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}

export function canTransitionOrder(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderState, to: OrderState): void {
  if (!canTransitionOrder(from, to)) throw new Error(`INVALID_ORDER_TRANSITION:${from}:${to}`);
}

export function legacyOrderState(status: unknown, fulfillmentStatus?: unknown): OrderState {
  if (fulfillmentStatus === 'fulfilled') return 'fulfilled';
  if (fulfillmentStatus === 'processing') return 'processing';
  if (fulfillmentStatus === 'cancelled') return 'cancelled';
  if (status === 'paid') return 'paid';
  if (status === 'payment_failed') return 'payment_failed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  return 'pending';
}
