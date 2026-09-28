import 'dotenv/config';
import crypto from 'node:crypto';
import express, { Request, Response } from 'express';
import { backgroundJobs, outbox } from './server';
import { captureServerException, startServerRequestSpan } from './server/infrastructure/observability/sentry';
import { traceIdFromHeaders } from './server/infrastructure/observability/logger';

const app = express();
app.use(express.json({ limit: '64kb' }));
const port = Number(process.env.PORT) || 8080;

app.use((req, res, next) => {
  const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : crypto.randomUUID();
  const finishSpan = startServerRequestSpan({ method: req.method, path: req.path, requestId });
  const startedAt = Date.now();
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => {
    finishSpan();
    console.log(JSON.stringify({ event: 'worker.request', requestId, traceId: traceIdFromHeaders(req.headers), method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt, release: process.env.RELEASE_ID || 'local', environment: process.env.APP_ENV || process.env.NODE_ENV || 'development' }));
  });
  next();
});

function authorized(req: Request): boolean {
  const expected = process.env.CLOUD_TASKS_AUTH_TOKEN || process.env.BACKGROUND_JOB_SECRET;
  if (!expected) return false;
  const provided = req.headers.authorization;
  return provided === `Bearer ${expected}` || req.headers['x-background-job-secret'] === expected;
}

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', role: 'worker', version: process.env.RELEASE_ID || 'local' }));
app.post('/tasks/background-jobs', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
  if (!jobId) return res.status(400).json({ error: 'JOB_ID_REQUIRED' });
  try {
    await backgroundJobs.run(jobId);
    return res.status(202).json({ accepted: true, jobId });
  } catch (error) {
    captureServerException(error, { requestId: String(res.getHeader('X-Request-ID') || ''), jobId, correlationId: jobId });
    return res.status(500).json({ error: 'JOB_EXECUTION_FAILED', jobId });
  }
});
app.get('/tasks/background-jobs/:jobId', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const jobId = String(req.params.jobId || '');
  const job = await backgroundJobs.status(jobId);
  if (!job) return res.status(404).json({ error: 'JOB_NOT_FOUND' });
  return res.status(200).json({ job: { id: job.id, kind: job.kind, status: job.status, attempts: job.attempts, maxAttempts: job.maxAttempts, availableAt: job.availableAt, correlationId: job.correlationId || job.id, lastError: job.lastError, completedAt: job.completedAt, deadLetteredAt: job.deadLetteredAt } });
});
app.post('/tasks/outbox-publish', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const result = await outbox.publishPending(Math.min(500, Math.max(1, Number(req.body?.limit) || 100)));
  return res.status(200).json(result);
});

if (process.env.NODE_ENV !== 'test') app.listen(port, '0.0.0.0', () => console.log(`[RALOA worker] Listening on ${port}`));
export default app;
