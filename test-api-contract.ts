import assert from 'node:assert/strict';
import { API_CONTRACTS, apiErrorSchema, idempotencyKeySchema, paginationQuerySchema } from './src/shared/schema';
import { apiErrorEnvelopeSchema, apiPaginationRequestSchema, apiSuccessEnvelope } from '@raloa/schemas';

assert.equal(API_CONTRACTS.publicBooking.auth, 'public');
assert.equal(API_CONTRACTS.publicBooking.idempotency, 'required');
assert.equal(paginationQuerySchema.parse({ limit: '20' }).limit, 20);
assert.equal(idempotencyKeySchema.safeParse('short').success, false);
assert.equal(apiErrorSchema.parse({ status: 'error', error: 'BAD_REQUEST', code: 'BAD_REQUEST', message: 'Invalid request' }).code, 'BAD_REQUEST');
assert.equal(apiErrorEnvelopeSchema.parse({ status: 'error', error: { code: 'VALIDATION_ERROR', kind: 'VALIDATION_ERROR', message: 'Invalid request', requestId: 'req_test' } }).error.kind, 'VALIDATION_ERROR');
assert.equal(apiPaginationRequestSchema.parse({ limit: '20' }).limit, 20);
assert.equal(apiSuccessEnvelope(apiPaginationRequestSchema).parse({ status: 'ok', data: { limit: 20 }, requestId: 'req_test' }).status, 'ok');
console.log('Versioned API contract tests passed');
