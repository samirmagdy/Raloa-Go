import type { Pool, PoolClient } from 'pg';
import type { OutboxEvent, OutboxEventInput, OutboxRepository, TransactionalOutboxProducer } from '../../outbox/types';
import { createOutboxEvent } from '../../outbox/event';

type OutboxRow = {
  id: string; event_type: string; event_version: number; aggregate_type: string; aggregate_id: string;
  idempotency_key: string; correlation_id: string | null; payload: Record<string, unknown>;
  status: OutboxEvent['status']; attempts: number; max_attempts: number; available_at: Date;
  lease_until: Date | null; last_error: string | null; published_at: Date | null;
  processed_at: Date | null; dead_lettered_at: Date | null; created_at: Date; updated_at: Date;
};

const iso = (value: Date | string | null | undefined): string | undefined => value ? new Date(value).toISOString() : undefined;
const uuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function mapRow(row: OutboxRow): OutboxEvent {
  return {
    id: row.id,
    eventType: row.event_type as OutboxEvent['eventType'],
    eventVersion: Number(row.event_version || 1),
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id || undefined,
    payload: row.payload || {},
    status: row.status,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    availableAt: row.available_at.toISOString(),
    leaseUntil: iso(row.lease_until),
    lastError: row.last_error || undefined,
    publishedAt: iso(row.published_at),
    processedAt: iso(row.processed_at),
    deadLetteredAt: iso(row.dead_lettered_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

const insertSql = (includeId: boolean) => `INSERT INTO outbox_events
  (${includeId ? 'id, ' : ''}event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload, status, attempts, max_attempts, available_at, created_at, updated_at)
  VALUES (${includeId ? '$1, ' : ''}${includeId ? '$2' : '$1'}, ${includeId ? '$3' : '$2'}, ${includeId ? '$4' : '$3'}, ${includeId ? '$5' : '$4'}, ${includeId ? '$6' : '$5'}, ${includeId ? '$7' : '$6'} , ${includeId ? '$8' : '$7'}::jsonb, 'pending', 0, $${includeId ? 9 : 8}, $${includeId ? 10 : 9}, now(), now())
  ON CONFLICT (idempotency_key) DO NOTHING`;

function insertValues(event: OutboxEvent, includeId: boolean): unknown[] {
  const values: unknown[] = [];
  if (includeId) values.push(event.id);
  values.push(event.eventType, event.eventVersion, event.aggregateType, event.aggregateId, event.idempotencyKey, event.correlationId || null, JSON.stringify(event.payload), event.maxAttempts, event.availableAt);
  return values;
}

async function insert(client: Pool | PoolClient, event: OutboxEvent): Promise<void> {
  if (!uuid(event.aggregateId)) throw new Error('OUTBOX_AGGREGATE_ID_MUST_BE_UUID');
  const includeId = uuid(event.id);
  await client.query(insertSql(includeId), insertValues(event, includeId));
}

/** Appends to the caller's transaction. It never opens or commits a transaction itself. */
export function createPostgresTransactionalOutbox(client: PoolClient): TransactionalOutboxProducer {
  return {
    create: (input: OutboxEventInput) => createOutboxEvent(input),
    append: (_transaction, event) => insert(client, event),
    appendMany: (_transaction, events) => Promise.all(events.map((event) => insert(client, event))).then(() => undefined)
  };
}

/** Use appendPostgresOutboxEvent when the transaction must await the insert. */
export async function appendPostgresOutboxEvent(client: PoolClient, event: OutboxEvent): Promise<void> {
  await insert(client, event);
}

export function createPostgresOutboxRepository(pool: Pool): OutboxRepository & {
  claimConsumer(eventId: string, consumerKey: string): Promise<boolean>;
  completeConsumer(eventId: string, consumerKey: string): Promise<void>;
} {
  return {
    async listDue(now, limit) {
      const result = await pool.query<OutboxRow>(`SELECT * FROM outbox_events WHERE status IN ('pending', 'retry', 'publishing') AND available_at <= $1 AND (lease_until IS NULL OR lease_until <= $1) ORDER BY created_at, id LIMIT $2`, [now, limit]);
      return result.rows.map(mapRow);
    },
    async claim(id, leaseUntil) {
      const result = await pool.query<OutboxRow>(`UPDATE outbox_events SET status = 'publishing', attempts = attempts + 1, lease_until = $2, updated_at = now() WHERE id = $1 AND status IN ('pending', 'retry', 'publishing') AND available_at <= now() AND (lease_until IS NULL OR lease_until <= now()) RETURNING *`, [id, leaseUntil]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async markPublished(id, publishedAt) {
      await pool.query(`UPDATE outbox_events SET status = 'published', published_at = $2, processed_at = $2, lease_until = NULL, updated_at = $2 WHERE id = $1 AND status = 'publishing'`, [id, publishedAt]);
    },
    async markFailed(id, error, availableAt, deadLetter) {
      const at = new Date().toISOString();
      await pool.query(`UPDATE outbox_events SET status = $2, last_error = $3, available_at = COALESCE($4, available_at), lease_until = NULL, dead_lettered_at = CASE WHEN $5 THEN $6 ELSE NULL END, updated_at = $6 WHERE id = $1 AND status = 'publishing'`, [id, deadLetter ? 'dead_letter' : 'retry', error.slice(0, 2000), availableAt || null, deadLetter, at]);
    },
    async replay(id, availableAt = new Date().toISOString()) {
      const result = await pool.query(`UPDATE outbox_events SET status = 'pending', attempts = 0, available_at = $2, lease_until = NULL, last_error = NULL, dead_lettered_at = NULL, processed_at = NULL, published_at = NULL, updated_at = now() WHERE id = $1 AND status IN ('published', 'dead_letter', 'retry')`, [id, availableAt]);
      return result.rowCount === 1;
    },
    async replayByCorrelation(correlationId, availableAt = new Date().toISOString()) {
      const result = await pool.query(`UPDATE outbox_events SET status = 'pending', attempts = 0, available_at = $2, lease_until = NULL, last_error = NULL, dead_lettered_at = NULL, processed_at = NULL, published_at = NULL, updated_at = now() WHERE correlation_id = $1 AND status IN ('published', 'dead_letter', 'retry')`, [correlationId, availableAt]);
      return result.rowCount || 0;
    },
    async list(filters = {}) {
      const values: unknown[] = []; const conditions: string[] = [];
      if (filters.status) { values.push(filters.status); conditions.push(`status = $${values.length}`); }
      if (filters.correlationId) { values.push(filters.correlationId); conditions.push(`correlation_id = $${values.length}`); }
      values.push(Math.min(Math.max(filters.limit || 100, 1), 1000));
      const result = await pool.query<OutboxRow>(`SELECT * FROM outbox_events${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${values.length}`, values);
      return result.rows.map(mapRow);
    },
    async claimConsumer(eventId, consumerKey) {
      const result = await pool.query(`INSERT INTO outbox_event_consumers (event_id, consumer_key, status, attempts, updated_at) VALUES ($1, $2, 'processing', 1, now()) ON CONFLICT (event_id, consumer_key) DO UPDATE SET attempts = outbox_event_consumers.attempts + 1, status = CASE WHEN outbox_event_consumers.status = 'processed' THEN 'processed' ELSE 'processing' END, updated_at = now() WHERE outbox_event_consumers.status <> 'processed' RETURNING event_id`, [eventId, consumerKey]);
      return result.rowCount === 1;
    },
    async completeConsumer(eventId, consumerKey) {
      await pool.query(`UPDATE outbox_event_consumers SET status = 'processed', processed_at = now(), updated_at = now() WHERE event_id = $1 AND consumer_key = $2`, [eventId, consumerKey]);
    },
    async cleanupPublished(publishedBefore, limit) {
      const result = await pool.query(`DELETE FROM outbox_events WHERE id IN (SELECT id FROM outbox_events WHERE status = 'published' AND published_at <= $1 ORDER BY published_at LIMIT $2)`, [publishedBefore, limit]);
      return result.rowCount || 0;
    }
  };
}
