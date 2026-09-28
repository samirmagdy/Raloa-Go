import type { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { BookingRecord, BookingsRepository } from '../../repositories/contracts';
import { withPostgresTransaction } from './client';

export type BookingReservationInput = BookingRecord & {
  idempotencyKey?: string;
};

export interface PostgresBookingsRepository extends BookingsRepository {
  reserveSlot(input: BookingReservationInput): Promise<BookingRecord>;
  listPage(cursor: string | null, limit: number): Promise<{ records: BookingRecord[]; nextCursor: string | null }>;
  listIds(): Promise<string[]>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredUuid(value: unknown, field: string): string {
  const candidate = String(value || '');
  if (!uuidPattern.test(candidate)) throw new Error(`BOOKING_TARGET_${field.toUpperCase()}_MAPPING_REQUIRED`);
  return candidate;
}

function statusForPostgres(value: unknown): 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' {
  if (value === 'confirmed') return 'confirmed';
  if (value === 'cancelled') return 'cancelled';
  if (value === 'completed') return 'completed';
  if (value === 'no_show') return 'no_show';
  return 'pending';
}

function statusForLegacy(value: string): string {
  return value === 'pending' ? 'pending_confirmation' : value;
}

function rowToBooking(row: Record<string, unknown>): BookingRecord {
  const payload = row.legacy_payload && typeof row.legacy_payload === 'object' ? row.legacy_payload as Record<string, unknown> : {};
  const canonical = {
    id: String(row.legacy_booking_id || row.id),
    hostUserId: String(row.external_auth_id || row.host_user_id),
    siteId: String(row.legacy_site_id || row.site_id),
    serviceId: String(row.legacy_service_id || row.service_id),
    slotStart: new Date(String(row.starts_at)).toISOString(),
    slotEnd: new Date(String(row.ends_at)).toISOString(),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    timezone: String(row.timezone),
    status: statusForLegacy(String(row.status)),
    confirmationStatus: String(row.status) === 'confirmed' ? 'confirmed' : String(row.status) === 'cancelled' ? 'cancelled' : 'pending',
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
  return { ...payload, ...canonical };
}

async function findByPublicId(client: Pool | PoolClient, id: string): Promise<{ bookingId: string; legacyId: string } | null> {
  const result = await client.query(
    `SELECT b.id::text AS booking_id, m.legacy_booking_id
       FROM bookings b
       LEFT JOIN booking_id_map m ON m.booking_id = b.id
      WHERE b.id::text = $1 OR m.legacy_booking_id = $1
      LIMIT 1`,
    [id]
  );
  return result.rows[0] ? { bookingId: result.rows[0].booking_id, legacyId: result.rows[0].legacy_booking_id || id } : null;
}

export function createPostgresBookingsRepository(pool: Pool): PostgresBookingsRepository {
  const getById = async (id: string, client: Pool | PoolClient = pool): Promise<BookingRecord | null> => {
    const result = await client.query(
      `SELECT b.*, m.legacy_booking_id, s.legacy_service_id, u.external_auth_id, st.legacy_site_id
         FROM bookings b
         LEFT JOIN booking_id_map m ON m.booking_id = b.id
         LEFT JOIN booking_services s ON s.id = b.service_id
         LEFT JOIN app_users u ON u.id = b.host_user_id
         LEFT JOIN sites st ON st.id = b.site_id
        WHERE b.id::text = $1 OR m.legacy_booking_id = $1
        LIMIT 1`,
      [id]
    );
    return result.rows[0] ? rowToBooking(result.rows[0]) : null;
  };

  const reserveSlot = async (input: BookingReservationInput): Promise<BookingRecord> => {
    const requestedSiteId = String(input.siteId || '');
    const requestedHostUserId = String(input.hostUserId || '');
    const requestedServiceId = String(input.serviceId || '');
    const startsAt = new Date(String(input.slotStart || input.startsAt || ''));
    const endsAt = new Date(String(input.slotEnd || input.endsAt || ''));
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) throw new Error('BOOKING_INVALID_TIME_RANGE');
    const legacyId = String(input.id || cryptoRandomUuid());
    const status = statusForPostgres(input.status);

    return withPostgresTransaction(pool, async (client) => {
      const siteResult = await client.query('SELECT id, owner_user_id FROM sites WHERE id::text = $1 OR legacy_site_id = $1 LIMIT 1', [requestedSiteId]);
      const hostResult = await client.query('SELECT id FROM app_users WHERE id::text = $1 OR external_auth_id = $1 LIMIT 1', [requestedHostUserId]);
      if (!siteResult.rows[0]) throw new Error('BOOKING_TARGET_SITE_MAPPING_REQUIRED');
      if (!hostResult.rows[0]) throw new Error('BOOKING_TARGET_HOST_USER_MAPPING_REQUIRED');
      const siteId = String(siteResult.rows[0].id);
      const hostUserId = String(hostResult.rows[0].id);
      const serviceResult = await client.query('SELECT id FROM booking_services WHERE site_id = $1 AND (id::text = $2 OR legacy_service_id = $2) LIMIT 1', [siteId, requestedServiceId]);
      const serviceId = serviceResult.rows[0] ? String(serviceResult.rows[0].id) : requiredUuid(requestedServiceId, 'service');
      const existingIdempotency = input.idempotencyKey
        ? await client.query('SELECT booking_id FROM booking_idempotency_keys WHERE site_id = $1 AND idempotency_key = $2 FOR UPDATE', [siteId, input.idempotencyKey])
        : { rows: [] };
      if (existingIdempotency.rows[0]?.booking_id) return (await getById(String(existingIdempotency.rows[0].booking_id), client)) as BookingRecord;
      if (existingIdempotency.rows[0]) throw new Error('BOOKING_IDEMPOTENCY_IN_PROGRESS');

      await client.query(
        `INSERT INTO booking_services (id, site_id, slug, name, duration_minutes, buffer_minutes)
         VALUES ($1, $2, $3, $4, $5, 0)
         ON CONFLICT (id) DO NOTHING`,
        [serviceId, siteId, requestedServiceId, String(input.serviceName || input.serviceId), Math.max(15, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000))]
      );
      await client.query(
        `INSERT INTO booking_slots (site_id, service_id, starts_at, ends_at, timezone)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (site_id, service_id, starts_at, ends_at) DO NOTHING`,
        [siteId, serviceId, startsAt.toISOString(), endsAt.toISOString(), String(input.timezone || 'UTC')]
      );
      const slot = await client.query(
        `SELECT id, capacity, booked_count, status
           FROM booking_slots
          WHERE site_id = $1 AND service_id = $2 AND starts_at = $3 AND ends_at = $4
          FOR UPDATE`,
        [siteId, serviceId, startsAt.toISOString(), endsAt.toISOString()]
      );
      if (!slot.rows[0] || slot.rows[0].status === 'blocked' || Number(slot.rows[0].booked_count) >= Number(slot.rows[0].capacity)) throw new Error('BOOKING_SLOT_TAKEN');

      const inserted = await client.query(
        `INSERT INTO bookings (site_id, host_user_id, service_id, slot_id, customer_name, customer_email, starts_at, ends_at, timezone, status, notes, legacy_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
         RETURNING id`,
        [siteId, hostUserId, serviceId, slot.rows[0].id, String(input.customerName || ''), String(input.customerEmail || ''), startsAt.toISOString(), endsAt.toISOString(), String(input.timezone || 'UTC'), status, input.notes ? String(input.notes) : null, JSON.stringify(input)]
      );
      const bookingId = inserted.rows[0].id as string;
      await client.query('INSERT INTO booking_id_map (legacy_booking_id, booking_id) VALUES ($1, $2)', [legacyId, bookingId]);
      await client.query(
        `UPDATE booking_slots SET booked_count = booked_count + 1, status = CASE WHEN booked_count + 1 >= capacity THEN 'booked'::booking_slot_status ELSE status END WHERE id = $1`,
        [slot.rows[0].id]
      );
      if (input.idempotencyKey) {
        await client.query(
          `INSERT INTO booking_idempotency_keys (site_id, idempotency_key, request_hash, booking_id, response_status, response_body, expires_at)
           VALUES ($1, $2, md5($3), $4, 201, $5::jsonb, now() + interval '24 hours')`,
          [siteId, input.idempotencyKey, JSON.stringify(input), bookingId, JSON.stringify({ id: legacyId, status: input.status || 'pending_confirmation' })]
        );
      }
      await client.query(
        `INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload)
         VALUES ('BookingCreated.v1', 1, 'booking', $1, $2, $2, $3::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [bookingId, `booking:${legacyId}:created`, JSON.stringify({ bookingId: legacyId, hostUserId, siteId })]
      );
      return (await getById(bookingId, client)) as BookingRecord;
    });
  };

  return {
    async get(id) { return getById(id); },
    async listForHost(hostUserId, siteId, limit = 100) {
      const host = await pool.query('SELECT id FROM app_users WHERE id::text = $1 OR external_auth_id = $1 LIMIT 1', [hostUserId]);
      if (!host.rows[0]) return [];
      const values: unknown[] = [host.rows[0].id];
      let where = 'b.host_user_id = $1';
      if (siteId) {
        const site = await pool.query('SELECT id FROM sites WHERE id::text = $1 OR legacy_site_id = $1 LIMIT 1', [siteId]);
        if (!site.rows[0]) return [];
        values.push(site.rows[0].id);
        where += ` AND b.site_id = $${values.length}`;
      }
      values.push(Math.min(Math.max(limit, 1), 100));
      const result = await pool.query(`SELECT b.*, m.legacy_booking_id, s.legacy_service_id, u.external_auth_id, st.legacy_site_id FROM bookings b LEFT JOIN booking_id_map m ON m.booking_id = b.id LEFT JOIN booking_services s ON s.id = b.service_id LEFT JOIN app_users u ON u.id = b.host_user_id LEFT JOIN sites st ON st.id = b.site_id WHERE ${where} ORDER BY b.created_at DESC, b.id DESC LIMIT $${values.length}`, values);
      return result.rows.map(rowToBooking);
    },
    async create(id, booking) { await reserveSlot({ ...booking, id }); },
    async update(id, changes) {
      await withPostgresTransaction(pool, async (client) => {
        const found = await findByPublicId(client, id);
        if (!found) throw new Error('BOOKING_NOT_FOUND');
        const current = await client.query('SELECT status, slot_id, site_id FROM bookings WHERE id = $1 FOR UPDATE', [found.bookingId]);
        if (!current.rows[0]) throw new Error('BOOKING_NOT_FOUND');
        const status = changes.status === undefined ? null : statusForPostgres(changes.status);
        const wasActive = current.rows[0].status === 'pending' || current.rows[0].status === 'confirmed';
        const becomesCancelled = status === 'cancelled' && wasActive;
        await client.query(`UPDATE bookings SET status = COALESCE($2::booking_status, status), notes = COALESCE($3, notes), updated_at = now(), legacy_payload = legacy_payload || $4::jsonb WHERE id = $1`, [found.bookingId, status, changes.notes ? String(changes.notes) : null, JSON.stringify(changes)]);
        if (becomesCancelled && current.rows[0].slot_id) {
          await client.query(`UPDATE booking_slots SET booked_count = GREATEST(booked_count - 1, 0), status = CASE WHEN status = 'booked' THEN 'available'::booking_slot_status ELSE status END, updated_at = now() WHERE id = $1`, [current.rows[0].slot_id]);
          await client.query(`INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload) VALUES ('BookingCancelled.v1', 1, 'booking', $1, $2, $2, $3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`, [found.bookingId, `booking:${found.legacyId}:cancelled`, JSON.stringify({ bookingId: found.legacyId, siteId: current.rows[0].site_id })]);
        }
      });
    },
    reserveSlot,
    async listPage(cursor, limit) {
      const safeLimit = Math.min(Math.max(limit, 1), 500);
      const result = cursor
        ? await pool.query('SELECT b.*, m.legacy_booking_id, s.legacy_service_id, u.external_auth_id, st.legacy_site_id FROM bookings b LEFT JOIN booking_id_map m ON m.booking_id = b.id LEFT JOIN booking_services s ON s.id = b.service_id LEFT JOIN app_users u ON u.id = b.host_user_id LEFT JOIN sites st ON st.id = b.site_id WHERE b.created_at < $1 ORDER BY b.created_at DESC, b.id DESC LIMIT $2', [cursor, safeLimit])
        : await pool.query('SELECT b.*, m.legacy_booking_id, s.legacy_service_id, u.external_auth_id, st.legacy_site_id FROM bookings b LEFT JOIN booking_id_map m ON m.booking_id = b.id LEFT JOIN booking_services s ON s.id = b.service_id LEFT JOIN app_users u ON u.id = b.host_user_id LEFT JOIN sites st ON st.id = b.site_id ORDER BY b.created_at DESC, b.id DESC LIMIT $1', [safeLimit]);
      const records = result.rows.map(rowToBooking);
      return { records, nextCursor: result.rows.length === safeLimit ? String(result.rows[result.rows.length - 1].created_at) : null };
    },
    async listIds() {
      const result = await pool.query('SELECT COALESCE(m.legacy_booking_id, b.id::text) AS id FROM bookings b LEFT JOIN booking_id_map m ON m.booking_id = b.id');
      return result.rows.map((row) => String(row.id));
    }
  };
}

function cryptoRandomUuid(): string {
  return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12);
}
