import assert from 'node:assert/strict';
import { API_CONTRACTS, apiErrorSchema, idempotencyKeySchema, paginationQuerySchema } from './src/shared/schema';

assert.equal(API_CONTRACTS.publicBooking.auth, 'public');
assert.equal(API_CONTRACTS.publicBooking.idempotency, 'required');
assert.equal(paginationQuerySchema.parse({ limit: '20' }).limit, 20);
assert.equal(idempotencyKeySchema.safeParse('short').success, false);
assert.equal(apiErrorSchema.parse({ status: 'error', error: 'BAD_REQUEST', code: 'BAD_REQUEST', message: 'Invalid request' }).code, 'BAD_REQUEST');
console.log('Versioned API contract tests passed');
