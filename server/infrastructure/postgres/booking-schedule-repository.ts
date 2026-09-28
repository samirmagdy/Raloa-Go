import type { Pool } from 'pg';
import { withPostgresTransaction } from './client';

type ScheduleRule = { weekday: number; startsAt: string; endsAt: string; timezone: string };
type ScheduleException = { startsAt: string; endsAt: string; reason: string | null };
export type PublishedBookingSchedule = {
  site: { id: string; accountId: string; handle: string };
  hostUserId: string;
  timezone: string;
  service: { id: string; name: string; description: string | null; durationMinutes: number; bufferMinutes: number; enabled: boolean; bookingWindowDays: number; minNoticeMinutes: number; maxBookingsPerDay: number };
  rules: ScheduleRule[];
  exceptions: ScheduleException[];
  blackoutDates: string[];
};

function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day, values.hour === 24 ? 0 : values.hour, values.minute, values.second) - date.getTime();
}

function localToUtc(date: string, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00.000Z`);
  const first = new Date(guess.getTime() - offsetMs(guess, timeZone));
  return new Date(guess.getTime() - offsetMs(first, timeZone));
}

function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function addDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}

function minutes(time: string): number { const [hours, mins] = time.slice(0, 5).split(':').map(Number); return hours * 60 + mins; }

export function createPostgresBookingScheduleRepository(pool: Pool) {
  async function listPublishedServices(handle: string) {
    const result = await pool.query<{ id: string; legacy_service_id: string | null; name: string; description: string | null; duration_minutes: number; buffer_minutes: number; enabled: boolean; timezone: string; booking_window_days: number }>(
      `SELECT bs.id::text, bs.legacy_service_id, bs.name, bs.description, bs.duration_minutes, bs.buffer_minutes, bs.enabled, bs.timezone, bs.booking_window_days
         FROM booking_services bs JOIN sites s ON s.id = bs.site_id
        WHERE s.handle = $1 AND s.is_published = true AND bs.enabled = true ORDER BY bs.created_at`, [handle.trim().toLowerCase()]
    );
    return result.rows.map((service) => ({ id: service.legacy_service_id || service.id, name: service.name, description: service.description, durationMinutes: service.duration_minutes, bufferMinutes: service.buffer_minutes, enabled: service.enabled, timezone: service.timezone, bookingWindowDays: service.booking_window_days }));
  }

  async function findPublishedSchedule(handle: string, serviceId: string): Promise<PublishedBookingSchedule | null> {
    const siteResult = await pool.query<{ id: string; account_id: string; handle: string; external_auth_id: string }>(
      `SELECT s.id::text, s.account_id::text, s.handle, u.external_auth_id
         FROM sites s JOIN app_users u ON u.id = s.owner_user_id
        WHERE s.handle = $1 AND s.is_published = true LIMIT 1`, [handle.trim().toLowerCase()]
    );
    const site = siteResult.rows[0]; if (!site) return null;
    const serviceResult = await pool.query<{ id: string; name: string; description: string | null; duration_minutes: number; buffer_minutes: number; enabled: boolean; timezone: string; booking_window_days: number; min_notice_minutes: number; max_bookings_per_day: number }>(
      `SELECT id::text, name, description, duration_minutes, buffer_minutes, enabled, timezone, booking_window_days, min_notice_minutes, max_bookings_per_day
         FROM booking_services WHERE site_id = $1 AND (id::text = $2 OR legacy_service_id = $2 OR slug = $2) LIMIT 1`, [site.id, serviceId]
    );
    const service = serviceResult.rows[0]; if (!service || !service.enabled) return null;
    const [rules, exceptions, blackouts] = await Promise.all([
      pool.query<ScheduleRule>('SELECT weekday, starts_at AS "startsAt", ends_at AS "endsAt", timezone FROM availability_rules WHERE site_id = $1 ORDER BY weekday, starts_at', [site.id]),
      pool.query<ScheduleException>('SELECT starts_at AS "startsAt", ends_at AS "endsAt", reason FROM availability_exceptions WHERE site_id = $1 ORDER BY starts_at', [site.id]),
      pool.query<{ blackout_date: string }>('SELECT blackout_date::text FROM booking_blackout_dates WHERE site_id = $1 ORDER BY blackout_date', [site.id])
    ]);
    return {
      site: { id: site.id, accountId: site.account_id, handle: site.handle }, hostUserId: site.external_auth_id,
      timezone: service.timezone, service: { id: service.id, name: service.name, description: service.description, durationMinutes: service.duration_minutes, bufferMinutes: service.buffer_minutes, enabled: service.enabled, bookingWindowDays: service.booking_window_days, minNoticeMinutes: service.min_notice_minutes, maxBookingsPerDay: service.max_bookings_per_day },
      rules: rules.rows, exceptions: exceptions.rows, blackoutDates: blackouts.rows.map((row) => row.blackout_date)
    };
  }

  async function ensureSlots(schedule: PublishedBookingSchedule, from: string, to: string): Promise<void> {
    await withPostgresTransaction(pool, async (client) => {
      for (let date = from; date <= to; date = addDate(date, 1)) {
        if (schedule.blackoutDates.includes(date)) continue;
        const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
        for (const rule of schedule.rules.filter((candidate) => candidate.weekday === weekday)) {
          for (let minute = minutes(rule.startsAt); minute + schedule.service.durationMinutes <= minutes(rule.endsAt); minute += Math.max(15, schedule.service.durationMinutes + schedule.service.bufferMinutes)) {
            const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
            const start = localToUtc(date, time, schedule.timezone);
            const end = new Date(start.getTime() + schedule.service.durationMinutes * 60000);
            if (start.getTime() < Date.now() + schedule.service.minNoticeMinutes * 60000 || start.getTime() > Date.now() + schedule.service.bookingWindowDays * 86400000) continue;
            if (schedule.exceptions.some((exception) => new Date(exception.startsAt).getTime() < end.getTime() && new Date(exception.endsAt).getTime() > start.getTime())) continue;
            await client.query(
              `INSERT INTO booking_slots (site_id, service_id, starts_at, ends_at, timezone)
               VALUES ($1, $2, $3, $4, $5) ON CONFLICT (site_id, service_id, starts_at, ends_at) DO NOTHING`,
              [schedule.site.id, schedule.service.id, start.toISOString(), end.toISOString(), schedule.timezone]
            );
          }
        }
      }
    });
  }

  async function listSlots(schedule: PublishedBookingSchedule, from: string, to: string) {
    await ensureSlots(schedule, from, to);
    const rangeStart = localToUtc(from, '00:00', schedule.timezone).toISOString();
    const rangeEnd = localToUtc(addDate(to, 1), '00:00', schedule.timezone).toISOString();
    const result = await pool.query<{ id: string; starts_at: Date; ends_at: Date; timezone: string }>(
      `SELECT id::text, starts_at, ends_at, timezone FROM booking_slots
        WHERE site_id = $1 AND service_id = $2 AND starts_at >= $3 AND starts_at < $4 AND status = 'available' AND booked_count < capacity
        ORDER BY starts_at`, [schedule.site.id, schedule.service.id, rangeStart, rangeEnd]
    );
    return result.rows.map((row) => ({ start: new Date(row.starts_at).toISOString(), end: new Date(row.ends_at).toISOString(), localDate: localDate(new Date(row.starts_at), row.timezone), localTime: new Intl.DateTimeFormat('en-GB', { timeZone: row.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(row.starts_at)), serviceId: schedule.service.id }));
  }

  return { listPublishedServices, findPublishedSchedule, ensureSlots, listSlots };
}
