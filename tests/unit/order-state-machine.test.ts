import { describe, expect, it } from 'vitest';
import { assertOrderTransition, canTransitionOrder, legacyOrderState } from '../../server/domains/orders/state-machine';

describe('order state machine', () => {
  it('allows only authoritative forward transitions', () => {
    expect(canTransitionOrder('pending', 'paid')).toBe(true);
    expect(canTransitionOrder('paid', 'fulfilled')).toBe(false);
    expect(() => assertOrderTransition('fulfilled', 'paid')).toThrow('INVALID_ORDER_TRANSITION');
  });

  it('normalizes legacy payment and fulfillment fields', () => {
    expect(legacyOrderState('paid', 'processing')).toBe('processing');
    expect(legacyOrderState('payment_failed')).toBe('payment_failed');
    expect(legacyOrderState('cancelled')).toBe('cancelled');
    expect(legacyOrderState('refunded')).toBe('refunded');
    expect(legacyOrderState('unknown')).toBe('pending');
  });
});
