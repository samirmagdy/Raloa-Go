import assert from 'node:assert/strict';
import { InMemoryMetrics, redactFields, traceIdFromHeaders } from './server/infrastructure/observability/logger';

const safe = redactFields({ requestId: 'req-1', authorization: 'Bearer secret', password: 'hidden', siteId: 'site-1', message: 'short' });
assert.equal(safe.authorization, '[REDACTED]');
assert.equal(safe.password, '[REDACTED]');
assert.equal(safe.siteId, 'site-1');
assert.equal(traceIdFromHeaders({ traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01' }), '0123456789abcdef0123456789abcdef');
const metrics = new InMemoryMetrics();
metrics.increment('http.requests', { route: '/api/test', status: 200 });
metrics.observe('http.duration_ms', 42, { route: '/api/test' });
assert.equal(metrics.counters.size, 1);
assert.equal(metrics.observations[0].valueMs, 42);
console.log('Observability tests passed');
