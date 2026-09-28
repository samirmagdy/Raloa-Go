import type { Pool, PoolClient } from 'pg';
import { withPostgresTransaction } from './client';
import type { AnalyticsEventV1 } from '../../../src/shared/schema';
import type { AnalyticsRawEventStore, AnalyticsRollupWriter } from '../../infrastructure/analytics/pipeline';

export type AnalyticsDashboard = {
  totalVisits: number; totalPageViews: number; uniqueVisitors: number; totalClicks: number;
  ctr: number | null; activeSitesCount: number; dateRange: { from: string | null; to: string };
  capped: boolean; truncated: boolean; dataSource: 'postgres_daily_rollups'; rollupFreshThrough: string | null;
  timeline: Array<{ date: string; views: number; clicks: number; uniqueVisitors: number }>;
  links: Array<{ linkId: string; title: string; url: string; blockType: string; clicks: number; share: number }>;
  utmSources: Array<{ source: string; medium: string; campaign: string; term?: string; content?: string; views: number; clicks: number; uniqueVisitors: number }>;
  referrers: Array<{ name: string; count: number }>; devices: Array<{ name: string; count: number }>;
  browsers: Array<{ name: string; count: number }>; countries: Array<{ name: string; count: number }>;
};

type ResolvedSite = { id: string; ownerId: string };
type NumericRow = Record<string, string | number | Date | null>;

const n = (value: unknown) => Number(value || 0);
const text = (value: unknown, fallback = '') => value == null ? fallback : String(value);
const safeDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

async function resolveSite(client: Pool | PoolClient, event: AnalyticsEventV1): Promise<ResolvedSite | null> {
  const result = await client.query<ResolvedSite>(
    `SELECT s.id::text AS id, s.owner_user_id::text AS "ownerId"
       FROM sites s JOIN app_users u ON u.id = s.owner_user_id
      WHERE (s.legacy_site_id = $1 OR s.id::text = $1)
        AND ($2 = '' OR u.external_auth_id = $2)
      LIMIT 1`, [event.siteId, event.siteOwnerId || '']);
  return result.rows[0] || null;
}

async function increment(client: PoolClient, table: string, columns: string[], values: unknown[], increments: string[]): Promise<void> {
  const updates = increments.map((column) => `${column} = ${table}.${column} + EXCLUDED.${column}`).join(', ');
  await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})
    ON CONFLICT DO UPDATE SET ${updates}, updated_at = now()`, values);
}

async function recordEvent(client: PoolClient, event: AnalyticsEventV1): Promise<'inserted' | 'duplicate'> {
  const site = await resolveSite(client, event);
  if (!site) throw new Error('ANALYTICS_SITE_NOT_FOUND');
  const raw = await client.query(
    `INSERT INTO analytics_events (event_id, site_id, site_owner_id, event_type, occurred_at, visitor_hash, dimensions, payload, retention_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now() + interval '7 days')
     ON CONFLICT (site_id, event_id) WHERE event_id IS NOT NULL DO NOTHING`,
    [event.eventId, site.id, site.ownerId, event.eventType, event.occurredAt, event.visitorHash || null, JSON.stringify(event.dimensions), JSON.stringify(event.payload)]
  );
  if ((raw.rowCount || 0) === 0) return 'duplicate';
  const day = event.occurredAt.slice(0, 10);
  const isView = event.eventType === 'page_view';
  const dimensions = event.dimensions || {};
  await increment(client, 'analytics_daily_rollups', ['site_id', 'site_owner_id', 'day', 'page_views', 'link_clicks', 'dimensions'], [site.id, site.ownerId, day, isView ? 1 : 0, isView ? 0 : 1, JSON.stringify({})], ['page_views', 'link_clicks']);
  let newVisitor = false;
  if (isView && event.visitorHash) {
    const visitor = await client.query(`INSERT INTO analytics_visitor_days (site_id, site_owner_id, day, visitor_hash, dimensions)
      VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING`, [site.id, site.ownerId, day, event.visitorHash, JSON.stringify(dimensions)]);
    newVisitor = (visitor.rowCount || 0) > 0;
    if (newVisitor) await client.query(`UPDATE analytics_daily_rollups SET unique_visitors = unique_visitors + 1, updated_at = now()
      WHERE site_id = $1 AND day = $2`, [site.id, day]);
  }
  for (const [dimension, key] of [['referrer', dimensions.referrerHost], ['device', dimensions.device], ['browser', dimensions.browser], ['country', dimensions.country]] as const) {
    const value = key || (dimension === 'referrer' ? '(direct)' : '(unknown)');
    await increment(client, 'analytics_dimension_daily_rollups', ['site_id', 'site_owner_id', 'day', 'dimension', 'dimension_value', 'page_views', 'clicks', 'unique_visitors'], [site.id, site.ownerId, day, dimension, value, isView ? 1 : 0, isView ? 0 : 1, newVisitor ? 1 : 0], ['page_views', 'clicks', 'unique_visitors']);
  }
  const payload = event.payload || {};
  const linkId = typeof payload.linkId === 'string' && payload.linkId ? payload.linkId : null;
  if (linkId) await increment(client, 'analytics_link_daily_rollups', ['site_id', 'site_owner_id', 'day', 'link_id', 'page_views', 'clicks', 'unique_visitors'], [site.id, site.ownerId, day, linkId, isView ? 1 : 0, isView ? 0 : 1, newVisitor ? 1 : 0], ['page_views', 'clicks', 'unique_visitors']);
  const utm = (name: string, fallback: string) => dimensions[name] || fallback;
  await increment(client, 'analytics_utm_daily_rollups', ['site_id', 'site_owner_id', 'day', 'source', 'medium', 'campaign', 'term', 'content', 'page_views', 'clicks', 'unique_visitors'], [site.id, site.ownerId, day, utm('utmSource', '(direct)'), utm('utmMedium', '(none)'), utm('utmCampaign', '(none)'), utm('utmTerm', '(none)'), utm('utmContent', '(none)'), isView ? 1 : 0, isView ? 0 : 1, newVisitor ? 1 : 0], ['page_views', 'clicks', 'unique_visitors']);
  return 'inserted';
}

export type PostgresAnalyticsRepository = AnalyticsRawEventStore & AnalyticsRollupWriter & {
  record(event: AnalyticsEventV1): Promise<'inserted' | 'duplicate'>;
  readDashboard(input: { siteOwnerId: string; siteId?: string; from: string | null; to: string; }): Promise<AnalyticsDashboard | null>;
};

export function createPostgresAnalyticsRepository(pool: Pool): PostgresAnalyticsRepository {
  return {
    append: (event) => withPostgresTransaction(pool, (client) => recordEvent(client, event)),
    update: async (events) => { await withPostgresTransaction(pool, async (client) => { for (const event of events) await recordEvent(client, event); }); },
    record: (event) => withPostgresTransaction(pool, (client) => recordEvent(client, event)),
    async readDashboard(input) {
      const from = input.from || new Date(Date.parse(`${input.to}T00:00:00.000Z`) - 399 * 86400000).toISOString().slice(0, 10);
      const to = safeDate(input.to) || new Date().toISOString().slice(0, 10);
      const values: unknown[] = [input.siteOwnerId, from, to];
      const siteClause = input.siteId ? ` AND (s.legacy_site_id = $4 OR s.id::text = $4)` : '';
      if (input.siteId) values.push(input.siteId);
      const siteJoin = `JOIN sites s ON s.id = r.site_id JOIN app_users u ON u.id = r.site_owner_id AND u.external_auth_id = $1`;
      const [summary, visitors, dimensions, links, utm] = await Promise.all([
        pool.query<NumericRow>(`SELECT r.day::text, r.page_views, r.link_clicks, r.unique_visitors, r.updated_at FROM analytics_daily_rollups r ${siteJoin} WHERE r.day BETWEEN $2::date AND $3::date${siteClause} ORDER BY r.day LIMIT 400`, values),
        pool.query<NumericRow>(`SELECT COUNT(*)::text AS count FROM analytics_visitor_days v JOIN sites s ON s.id = v.site_id JOIN app_users u ON u.id = v.site_owner_id AND u.external_auth_id = $1 WHERE v.day BETWEEN $2::date AND $3::date${input.siteId ? ' AND (s.legacy_site_id = $4 OR s.id::text = $4)' : ''}`, values),
        pool.query<NumericRow>(`SELECT d.dimension, d.dimension_value, SUM(d.page_views)::text AS page_views FROM analytics_dimension_daily_rollups d ${siteJoin} WHERE d.day BETWEEN $2::date AND $3::date${siteClause} GROUP BY d.dimension,d.dimension_value ORDER BY SUM(d.page_views) DESC LIMIT 80`, values),
        pool.query<NumericRow>(`SELECT l.link_id, SUM(l.clicks)::text AS clicks FROM analytics_link_daily_rollups l ${siteJoin} WHERE l.day BETWEEN $2::date AND $3::date${siteClause} GROUP BY l.link_id ORDER BY SUM(l.clicks) DESC LIMIT 100`, values),
        pool.query<NumericRow>(`SELECT u.source,u.medium,u.campaign,u.term,u.content,SUM(u.page_views)::text AS views,SUM(u.clicks)::text AS clicks,SUM(u.unique_visitors)::text AS unique_visitors FROM analytics_utm_daily_rollups u ${siteJoin} WHERE u.day BETWEEN $2::date AND $3::date${siteClause} GROUP BY u.source,u.medium,u.campaign,u.term,u.content ORDER BY SUM(u.page_views)+SUM(u.clicks) DESC LIMIT 100`, values)
      ]);
      if (!summary.rows.length) return null;
      const timeline = summary.rows.map((r) => ({ date: text(r.day), views: n(r.page_views), clicks: n(r.link_clicks), uniqueVisitors: n(r.unique_visitors) }));
      const totalPageViews = timeline.reduce((sum, r) => sum + r.views, 0); const totalClicks = timeline.reduce((sum, r) => sum + r.clicks, 0);
      const grouped = (name: string) => dimensions.rows.filter((r) => r.dimension === name).map((r) => ({ name: text(r.dimension_value), count: n(r.page_views) })).slice(0, 20);
      const linkRows = links.rows.map((r) => ({ linkId: text(r.link_id), title: text(r.link_id), url: '', blockType: text(r.link_id).startsWith('soc_') ? 'social' : 'link', clicks: n(r.clicks), share: totalClicks ? Number(((n(r.clicks) / totalClicks) * 100).toFixed(1)) : 0 }));
      return { totalVisits: totalPageViews, totalPageViews, uniqueVisitors: n(visitors.rows[0]?.count), totalClicks, ctr: totalPageViews ? Number(((totalClicks / totalPageViews) * 100).toFixed(2)) : null, activeSitesCount: input.siteId ? 1 : 0, dateRange: { from: input.from, to }, capped: false, truncated: false, dataSource: 'postgres_daily_rollups', rollupFreshThrough: summary.rows.map((r) => text(r.updated_at)).sort().pop() || null, timeline, links: linkRows, utmSources: utm.rows.map((r) => ({ source: text(r.source), medium: text(r.medium), campaign: text(r.campaign), term: text(r.term), content: text(r.content), views: n(r.views), clicks: n(r.clicks), uniqueVisitors: n(r.unique_visitors) })), referrers: grouped('referrer'), devices: grouped('device'), browsers: grouped('browser'), countries: grouped('country') };
    }
  };
}
