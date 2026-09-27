import assert from 'node:assert/strict';
import {
  assertBookingDoesNotConflict,
  assertEntitlementLimit,
  assertInventoryBalance,
  assertOAuthConnectionUsable,
  assertOAuthStateTransition,
  assertOrderStateTransition,
  assertPublishableSite,
  assertSiteOwnership,
  assertSlugAvailable,
  assertWebhookNotProcessed,
  bookingIntervalsOverlap
} from './server/core/domain-invariants';

const active = { startsAt: '2026-09-27T10:00:00.000Z', endsAt: '2026-09-27T11:00:00.000Z', status: 'confirmed' };
assert.equal(bookingIntervalsOverlap(active, { startsAt: '2026-09-27T10:30:00.000Z', endsAt: '2026-09-27T11:30:00.000Z', status: 'pending' }), true);
assert.equal(bookingIntervalsOverlap(active, { startsAt: '2026-09-27T11:00:00.000Z', endsAt: '2026-09-27T12:00:00.000Z', status: 'pending' }), false);
assert.throws(() => assertBookingDoesNotConflict(active, [active]), /BOOKING_CONFLICT/);

assert.doesNotThrow(() => assertInventoryBalance(5, 0, 2, 'reserve'));
assert.throws(() => assertInventoryBalance(1, 0, 2, 'reserve'), /INVENTORY_UNAVAILABLE/);
assert.throws(() => assertInventoryBalance(5, 0, 1, 'release'), /INVALID_INVENTORY_RELEASE/);
assert.throws(() => assertInventoryBalance(5, 0, 0, 'decrement'), /INVALID_QUANTITY/);

assert.doesNotThrow(() => assertOrderStateTransition('pending', 'paid'));
assert.throws(() => assertOrderStateTransition('paid', 'fulfilled'), /INVALID_ORDER_TRANSITION/);
assert.doesNotThrow(() => assertSiteOwnership('user-1', 'user-1'));
assert.throws(() => assertSiteOwnership('user-1', 'user-2'), /RESOURCE_NOT_FOUND/);
assert.doesNotThrow(() => assertSlugAvailable(false));
assert.throws(() => assertSlugAvailable(true), /HANDLE_IN_USE/);
assert.doesNotThrow(() => assertPublishableSite({ username: 'creator', displayName: 'Creator', bio: 'Bio', templateId: 'elena' }));
assert.throws(() => assertPublishableSite({ username: 'creator', displayName: '', bio: 'Bio', templateId: 'elena' }), /PUBLISH_REQUIREMENTS_NOT_MET/);
assert.doesNotThrow(() => assertEntitlementLimit(3, 3));
assert.throws(() => assertEntitlementLimit(3, 4), /ENTITLEMENT_LIMIT_EXCEEDED/);
assert.throws(() => assertEntitlementLimit(3, -1), /INVALID_ENTITLEMENT_VALUE/);
assert.doesNotThrow(() => assertWebhookNotProcessed(false));
assert.throws(() => assertWebhookNotProcessed(true), /WEBHOOK_ALREADY_PROCESSED/);
assert.doesNotThrow(() => assertOAuthConnectionUsable('connected'));
assert.throws(() => assertOAuthConnectionUsable('revoked'), /OAUTH_REAUTH_REQUIRED/);
assert.doesNotThrow(() => assertOAuthStateTransition('connected', 'reauthorization_required'));
assert.throws(() => assertOAuthStateTransition('revoked', 'error'), /INVALID_OAUTH_STATE_TRANSITION/);

console.log('Domain invariant tests passed');
