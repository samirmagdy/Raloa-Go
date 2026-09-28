import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createConfiguredPostgresDatabase, createPostgresBookingsRepository } from './server/infrastructure/postgres';

const databaseUrl = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('Booking concurrency test skipped: PostgreSQL is not configured.');
} else {
  const { pool } = createConfiguredPostgresDatabase({ ...process.env, POSTGRES_ENABLED: 'true', POSTGRES_ENVIRONMENT: process.env.POSTGRES_ENVIRONMENT || 'test' });
  const suffix = crypto.randomUUID();
  const externalUser = `booking-concurrency-${suffix}`;
  const handle = `booking-${suffix.slice(0, 20)}`;
  const siteLegacyId = `legacy-${suffix}`;
  const serviceLegacyId = `service-${suffix}`;
  const bookingOne = `legacy-booking-one-${suffix}`;
  const bookingTwo = `legacy-booking-two-${suffix}`;
  try {
    const user = await pool.query<{ id: string }>('INSERT INTO app_users (external_auth_id) VALUES ($1) RETURNING id', [externalUser]);
    const account = await pool.query<{ id: string }>('INSERT INTO accounts (primary_user_id, name) VALUES ($1, $2) RETURNING id', [user.rows[0].id, `Concurrency ${suffix}`]);
    await pool.query("INSERT INTO account_memberships (account_id, user_id, role) VALUES ($1, $2, 'owner')", [account.rows[0].id, user.rows[0].id]);
    const site = await pool.query<{ id: string }>(
      'INSERT INTO sites (owner_user_id, account_id, legacy_site_id, handle, display_name, content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [user.rows[0].id, account.rows[0].id, siteLegacyId, handle, 'Concurrency test', '{}']
    );
    const service = await pool.query<{ id: string }>(
      'INSERT INTO booking_services (site_id, legacy_service_id, slug, name, duration_minutes) VALUES ($1, $2, $3, $4, 30) RETURNING id',
      [site.rows[0].id, serviceLegacyId, serviceLegacyId, 'Concurrency test service']
    );
    const startsAt = new Date(Date.now() + 86400000).toISOString();
    const endsAt = new Date(Date.parse(startsAt) + 1800000).toISOString();
    await pool.query('INSERT INTO booking_slots (site_id, service_id, starts_at, ends_at, timezone) VALUES ($1, $2, $3, $4, $5)', [site.rows[0].id, service.rows[0].id, startsAt, endsAt, 'UTC']);
    const repository = createPostgresBookingsRepository(pool);
    const results = await Promise.allSettled([
      repository.reserveSlot({ id: bookingOne, siteId: site.rows[0].id, hostUserId: user.rows[0].id, serviceId: service.rows[0].id, slotStart: startsAt, slotEnd: endsAt, timezone: 'UTC', customerName: 'One', customerEmail: 'one@example.com', status: 'pending' }),
      repository.reserveSlot({ id: bookingTwo, siteId: site.rows[0].id, hostUserId: user.rows[0].id, serviceId: service.rows[0].id, slotStart: startsAt, slotEnd: endsAt, timezone: 'UTC', customerName: 'Two', customerEmail: 'two@example.com', status: 'pending' })
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected' && (result.reason as Error).message === 'BOOKING_SLOT_TAKEN').length, 1);
    console.log('Booking concurrency test passed');
  } finally {
    await pool.query('DELETE FROM booking_idempotency_keys WHERE site_id IN (SELECT id FROM sites WHERE legacy_site_id = $1)', [siteLegacyId]);
    await pool.query('DELETE FROM outbox_events WHERE aggregate_id IN (SELECT b.id FROM bookings b JOIN sites s ON s.id = b.site_id WHERE s.legacy_site_id = $1)', [siteLegacyId]);
    await pool.query('DELETE FROM booking_id_map WHERE booking_id IN (SELECT b.id FROM bookings b JOIN sites s ON s.id = b.site_id WHERE s.legacy_site_id = $1)', [siteLegacyId]);
    await pool.query('DELETE FROM sites WHERE legacy_site_id = $1', [siteLegacyId]);
    await pool.query('DELETE FROM account_memberships WHERE account_id IN (SELECT id FROM accounts WHERE name = $1)', [`Concurrency ${suffix}`]);
    await pool.query('DELETE FROM accounts WHERE name = $1', [`Concurrency ${suffix}`]);
    await pool.query('DELETE FROM app_users WHERE external_auth_id = $1', [externalUser]);
    await pool.end();
  }
}
