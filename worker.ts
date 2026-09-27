import 'dotenv/config';
import express, { Request, Response } from 'express';
import { backgroundJobs, outbox } from './server';

const app = express();
app.use(express.json({ limit: '64kb' }));
const port = Number(process.env.PORT) || 8080;

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
  await backgroundJobs.run(jobId);
  return res.status(202).json({ accepted: true, jobId });
});
app.post('/tasks/outbox-publish', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const result = await outbox.publishPending(Math.min(500, Math.max(1, Number(req.body?.limit) || 100)));
  return res.status(200).json(result);
});

if (process.env.NODE_ENV !== 'test') app.listen(port, '0.0.0.0', () => console.log(`[RALOA worker] Listening on ${port}`));
export default app;

