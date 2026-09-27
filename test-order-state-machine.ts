import assert from 'node:assert/strict';
import { assertOrderTransition, canTransitionOrder, legacyOrderState } from './server/domains/orders/state-machine';

assert.equal(canTransitionOrder('pending', 'paid'), true);
assert.equal(canTransitionOrder('paid', 'processing'), true);
assert.equal(canTransitionOrder('processing', 'fulfilled'), true);
assert.equal(canTransitionOrder('fulfilled', 'paid'), false);
assert.equal(canTransitionOrder('cancelled', 'processing'), false);
assert.doesNotThrow(() => assertOrderTransition('paid', 'refunded'));
assert.throws(() => assertOrderTransition('fulfilled', 'processing'), /INVALID_ORDER_TRANSITION/);
assert.equal(legacyOrderState('paid', 'unfulfilled'), 'paid');
assert.equal(legacyOrderState('pending_payment', 'unfulfilled'), 'pending');
assert.equal(legacyOrderState('paid', 'fulfilled'), 'fulfilled');
console.log('Order state machine tests passed');
