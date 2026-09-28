import 'dotenv/config';
import { adminDb } from '../server-services';
import { createConfiguredPostgresDatabase } from '../server/infrastructure/postgres';

const runtime = createConfiguredPostgresDatabase();
const pool = runtime.pool;
const report = { sites: 0, services: 0, rules: 0, exceptions: 0, blackouts: 0, skipped: 0 };

function asString(value: unknown, fallback = '') { return typeof value === 'string' ? value : fallback; }
function asNumber(value: unknown, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }

try {
  const users = await adminDb.collection('users').get();
  for (const user of users.docs) {
    const sites = await user.ref.collection('sites').get();
    for (const legacySite of sites.docs) {
      const raw = legacySite.data() || {};
      const config = (raw.bookingConfig || {}) as Record<string, unknown>;
      const siteResult = await pool.query<{ id: string }>(
        `SELECT s.id::text FROM sites s JOIN app_users u ON u.id = s.owner_user_id
          WHERE (s.id::text = $1 OR s.legacy_site_id = $1) AND u.external_auth_id = $2 LIMIT 1`, [legacySite.id, user.id]
      );
      const site = siteResult.rows[0];
      if (!site) { report.skipped += 1; continue; }
      const timezone = asString(config.timezone, 'UTC');
      const services = Array.isArray(config.services) ? config.services as Array<Record<string, unknown>> : [];
      const weekly = (config.weeklyAvailability || {}) as Record<string, Record<string, unknown>>;
      const blackouts = Array.isArray(config.blackoutDates) ? config.blackoutDates.filter((value): value is string => typeof value === 'string') : [];
      await pool.query('BEGIN');
      try {
        for (const service of services) {
          const legacyServiceId = asString(service.id);
          if (!legacyServiceId) continue;
          await pool.query(
            `INSERT INTO booking_services (site_id, legacy_service_id, slug, name, description, duration_minutes, buffer_minutes, enabled, timezone, min_notice_minutes, booking_window_days, max_bookings_per_day)
             VALUES ($1, $2, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
             ON CONFLICT (site_id, legacy_service_id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, description = EXCLUDED.description, duration_minutes = EXCLUDED.duration_minutes, buffer_minutes = EXCLUDED.buffer_minutes, timezone = EXCLUDED.timezone, min_notice_minutes = EXCLUDED.min_notice_minutes, booking_window_days = EXCLUDED.booking_window_days, max_bookings_per_day = EXCLUDED.max_bookings_per_day, updated_at = now()`,
            [site.id, legacyServiceId, asString(service.name, legacyServiceId), asString(service.description) || null, Math.max(1, Math.round(asNumber(service.durationMinutes, 30))), Math.max(0, Math.round(asNumber(service.bufferMinutes, asNumber(config.bufferMinutes, 0)))), timezone, Math.max(0, Math.round(asNumber(config.minNoticeMinutes, 0))), Math.max(1, Math.round(asNumber(config.bookingWindowDays, 30))), Math.max(1, Math.round(asNumber(config.maxBookingsPerDay, 10)))]
          );
          report.services += 1;
        }
        await pool.query('DELETE FROM availability_rules WHERE site_id = $1', [site.id]);
        for (const [weekday, window] of Object.entries(weekly)) {
          if (window?.enabled !== true) continue;
          await pool.query('INSERT INTO availability_rules (site_id, weekday, starts_at, ends_at, timezone) VALUES ($1, $2, $3, $4, $5)', [site.id, Number(weekday), `${asString(window.start, '09:00')}:00`, `${asString(window.end, '17:00')}:00`, timezone]);
          report.rules += 1;
        }
        for (const date of blackouts) {
          await pool.query('INSERT INTO booking_blackout_dates (site_id, blackout_date) VALUES ($1, $2) ON CONFLICT (site_id, blackout_date) DO NOTHING', [site.id, date]);
          report.blackouts += 1;
        }
        await pool.query('COMMIT');
        report.sites += 1;
      } catch (error) {
        await pool.query('ROLLBACK');
        report.skipped += 1;
        console.error('[Booking schedule migration]', { userId: user.id, siteId: legacySite.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  console.log(JSON.stringify({ event: 'booking_schedule_migration_completed', ...report }));
} finally {
  await pool.end();
}
