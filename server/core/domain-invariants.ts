import { assertOrderTransition, type OrderState } from '../domains/orders/state-machine';

export type BookingInterval = {
  startsAt: string;
  endsAt: string;
  status?: string;
};

const ACTIVE_BOOKING_STATES = new Set(['pending', 'confirmed']);

export function assertPositiveQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('INVALID_QUANTITY');
}

export function assertInventoryBalance(available: number, reserved: number, quantity: number, operation: 'reserve' | 'release' | 'decrement'): void {
  assertPositiveQuantity(quantity);
  if (!Number.isSafeInteger(available) || available < 0 || !Number.isSafeInteger(reserved) || reserved < 0) throw new Error('INVALID_INVENTORY_BALANCE');
  if ((operation === 'reserve' || operation === 'decrement') && available < quantity) throw new Error('INVENTORY_UNAVAILABLE');
  if (operation === 'release' && reserved < quantity) throw new Error('INVALID_INVENTORY_RELEASE');
}

export function bookingIntervalsOverlap(left: BookingInterval, right: BookingInterval): boolean {
  if (!ACTIVE_BOOKING_STATES.has(left.status || 'pending') || !ACTIVE_BOOKING_STATES.has(right.status || 'pending')) return false;
  const leftStart = Date.parse(left.startsAt);
  const leftEnd = Date.parse(left.endsAt);
  const rightStart = Date.parse(right.startsAt);
  const rightEnd = Date.parse(right.endsAt);
  if (![leftStart, leftEnd, rightStart, rightEnd].every(Number.isFinite) || leftStart >= leftEnd || rightStart >= rightEnd) throw new Error('INVALID_BOOKING_INTERVAL');
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function assertBookingDoesNotConflict(candidate: BookingInterval, existing: readonly BookingInterval[]): void {
  if (existing.some((booking) => bookingIntervalsOverlap(candidate, booking))) throw new Error('BOOKING_CONFLICT');
}

export function assertSiteOwnership(ownerUserId: string, actorUserId: string): void {
  if (!ownerUserId || ownerUserId !== actorUserId) throw new Error('RESOURCE_NOT_FOUND');
}

export function assertSlugAvailable(taken: boolean): void {
  if (taken) throw new Error('HANDLE_IN_USE');
}

export function assertPublishableSite(input: { username?: string; displayName?: string; bio?: string; templateId?: string; validationIssues?: readonly unknown[] }): void {
  if (!input.username || !input.displayName || !input.bio || !input.templateId) throw new Error('PUBLISH_REQUIREMENTS_NOT_MET');
  if (input.validationIssues?.length) throw new Error('INVALID_SITE_CONTENT');
}

export function assertEntitlementLimit(limit: number | null, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_ENTITLEMENT_VALUE');
  if (limit !== null && value > limit) throw new Error('ENTITLEMENT_LIMIT_EXCEEDED');
}

export function assertWebhookNotProcessed(processed: boolean): void {
  if (processed) throw new Error('WEBHOOK_ALREADY_PROCESSED');
}

export type OAuthConnectionState = 'connected' | 'refreshing' | 'reauthorization_required' | 'revoked' | 'error';
const OAUTH_TRANSITIONS: Record<OAuthConnectionState, readonly OAuthConnectionState[]> = {
  connected: ['refreshing', 'reauthorization_required', 'revoked', 'error'],
  refreshing: ['connected', 'reauthorization_required', 'error'],
  reauthorization_required: ['connected', 'revoked'],
  revoked: ['connected'],
  error: ['connected', 'reauthorization_required', 'revoked']
};

export function assertOAuthStateTransition(from: OAuthConnectionState, to: OAuthConnectionState): void {
  if (from !== to && !OAUTH_TRANSITIONS[from].includes(to)) throw new Error(`INVALID_OAUTH_STATE_TRANSITION:${from}:${to}`);
}

export function assertOAuthConnectionUsable(state: OAuthConnectionState): void {
  if (state !== 'connected') throw new Error('OAUTH_REAUTH_REQUIRED');
}

export function assertOrderStateTransition(from: OrderState, to: OrderState): void {
  assertOrderTransition(from, to);
}
