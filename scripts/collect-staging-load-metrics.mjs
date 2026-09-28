import fs from 'node:fs/promises';
import pg from 'pg';
import { CloudTasksClient } from '@google-cloud/tasks';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const output = process.env.LOAD_METRICS_OUTPUT || 'reports/staging-load-metrics.json';
const startedAt = new Date().toISOString();
const result = { startedAt, capturedAt: null, postgres: null, applicationMetrics: null, cloudTasks: null, cloudRun: null };

if (!process.env.POSTGRES_DATABASE_URL) throw new Error('POSTGRES_DATABASE_URL is required for load observation');
if (process.env.POSTGRES_ENVIRONMENT !== 'staging') throw new Error('POSTGRES_ENVIRONMENT must be staging');

const client = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL, ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' } : false });
await client.connect();
try {
  const [activity, locks, settings] = await Promise.all([
    client.query(`SELECT count(*) FILTER (WHERE state = 'active')::int AS active, count(*) FILTER (WHERE wait_event IS NOT NULL)::int AS waiting, count(*)::int AS total FROM pg_stat_activity WHERE datname = current_database()`),
    client.query(`SELECT count(*)::int AS waiting_locks, COALESCE(max(EXTRACT(EPOCH FROM (now() - query_start))), 0)::float AS oldest_wait_seconds FROM pg_stat_activity WHERE wait_event_type = 'Lock'`),
    client.query(`SELECT setting::int AS max_connections FROM pg_settings WHERE name = 'max_connections'`)
  ]);
  result.postgres = { activity: activity.rows[0], locks: locks.rows[0], maxConnections: settings.rows[0]?.max_connections ?? null };
} finally { await client.end(); }

if (process.env.CLOUD_TASKS_PROJECT_ID && process.env.CLOUD_TASKS_LOCATION && process.env.CLOUD_TASKS_QUEUE) {
  const tasks = new CloudTasksClient();
  const name = tasks.queuePath(process.env.CLOUD_TASKS_PROJECT_ID, process.env.CLOUD_TASKS_LOCATION, process.env.CLOUD_TASKS_QUEUE);
  const [queue] = await tasks.getQueue({ name });
  result.cloudTasks = { name, state: queue.state, tasksCount: queue.stats?.tasksCount ?? null, oldestEstimatedArrivalTime: queue.stats?.oldestEstimatedArrivalTime ?? null, rateLimits: queue.rateLimits ?? null };
}

if (process.env.LOAD_METRICS_URL && process.env.LOAD_METRICS_SECRET) {
  const response = await fetch(process.env.LOAD_METRICS_URL, { headers: { 'x-background-job-secret': process.env.LOAD_METRICS_SECRET }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`application metrics endpoint returned ${response.status}`);
  result.applicationMetrics = await response.text();
}

if (process.env.GCP_PROJECT_ID && process.env.GCP_REGION && process.env.CLOUD_RUN_SERVICE) {
  try {
    const { stdout } = await exec('gcloud', ['monitoring', 'time-series', 'list', `--project=${process.env.GCP_PROJECT_ID}`, '--filter', `resource.type="cloud_run_revision" AND resource.labels.service_name="${process.env.CLOUD_RUN_SERVICE}"`, '--format=json', '--limit=100']);
    result.cloudRun = JSON.parse(stdout);
  } catch (error) {
    result.cloudRun = { error: error instanceof Error ? error.message : String(error) };
  }
}

result.capturedAt = new Date().toISOString();
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ event: 'staging_load_metrics_captured', output, postgres: result.postgres, applicationMetrics: Boolean(result.applicationMetrics), cloudTasks: result.cloudTasks ? { state: result.cloudTasks.state, tasksCount: result.cloudTasks.tasksCount } : null, cloudRun: Boolean(result.cloudRun) }));
