import type { Pool, QueryResultRow } from 'pg';

export type AudienceKind = 'subscribers' | 'submissions';
export type AudienceFilters = { search?: string; status?: string; from?: string | null; to?: string | null; tags?: string[] };
export type AudienceCursor = { createdAt: string; id: string };
export type AudienceSite = { id: string; accountId: string; handle: string };
export type AudienceList = { records: Record<string, unknown>[]; total: number; nextCursor: string | null; hasMore: boolean };
export type AudienceMetrics = {
  subscribers: number; activeSubscribers: number; newSubscribers: number;
  submissions: number; newSubmissions: number; uniqueVisitors: number; conversionRate: number | null;
};

const encodeCursor = (cursor: AudienceCursor) => Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
export function decodeAudienceCursor(value: unknown): AudienceCursor | null {
  if (typeof value !== 'string' || value.length > 512) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    return typeof parsed.createdAt === 'string' && typeof parsed.id === 'string' ? { createdAt: parsed.createdAt, id: parsed.id } : null;
  } catch { return null; }
}

type AudienceRow = QueryResultRow & { id: string; created_at: Date | string; total?: string; site_id?: string; account_id?: string };

function rangeWhere(filters: AudienceFilters, start: number): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (filters.status) { values.push(filters.status); clauses.push(`status = $${start + values.length - 1}`); }
  if (filters.from) { values.push(filters.from); clauses.push(`created_at >= $${start + values.length - 1}::date`); }
  if (filters.to) { values.push(filters.to); clauses.push(`created_at < ($${start + values.length - 1}::date + interval '1 day')`); }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values };
}

export function createPostgresAudienceRepository(pool: Pool) {
  async function findSiteByHandle(handle: string): Promise<AudienceSite | null> {
    const result = await pool.query<AudienceSite>(
      `SELECT id::text, account_id::text AS "accountId", handle
         FROM sites WHERE handle = $1 AND is_published = true LIMIT 1`, [handle.trim().toLowerCase()]
    );
    return result.rows[0] || null;
  }

  async function findOwnedSite(userId: string, siteId?: string, handle?: string): Promise<AudienceSite | null> {
    const values: string[] = [userId];
    const clauses = ['u.external_auth_id = $1', 's.account_id IS NOT NULL'];
    if (siteId) { values.push(siteId); clauses.push(`s.id::text = $${values.length}`); }
    if (handle) { values.push(handle.trim().toLowerCase()); clauses.push(`s.handle = $${values.length}`); }
    const result = await pool.query<AudienceSite>(
      `SELECT s.id::text, s.account_id::text AS "accountId", s.handle
         FROM sites s JOIN app_users u ON u.id = s.owner_user_id
        WHERE ${clauses.join(' AND ')} LIMIT 1`, values
    );
    return result.rows[0] || null;
  }

  function table(kind: AudienceKind) { return kind === 'subscribers' ? 'audience_subscribers' : 'form_submissions'; }

  function searchWhere(kind: AudienceKind, search: string | undefined, start: number): { sql: string; values: unknown[] } {
    if (!search) return { sql: '', values: [] };
    const value = `%${search}%`;
    if (kind === 'subscribers') return { sql: ` AND (email ILIKE $${start} OR source ILIKE $${start} OR name ILIKE $${start})`, values: [value] };
    return { sql: ` AND (submitter_email ILIKE $${start} OR payload->>'fullName' ILIKE $${start} OR payload->>'subject' ILIKE $${start} OR payload->>'message' ILIKE $${start})`, values: [value] };
  }

  function response(kind: AudienceKind, row: AudienceRow): Record<string, unknown> {
    const payload = (row.payload || {}) as Record<string, unknown>;
    if (kind === 'subscribers') return {
      id: row.id, email: row.email, name: row.name || '', source: row.source,
      status: row.status === 'subscribed' ? 'active' : row.status, tags: row.tags || [],
      consentStatus: row.consent_status || 'unknown', createdAt: row.created_at, updatedAt: row.updated_at
    };
    return {
      id: row.id, name: payload.fullName || payload.name || '', email: row.submitter_email || payload.email || '',
      subject: payload.subject || '', message: payload.message || '', source: row.source,
      status: row.status === 'received' ? 'new' : row.status === 'processed' ? 'read' : row.status,
      consentStatus: row.consent_status || 'unknown', createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  async function list(kind: AudienceKind, site: AudienceSite, filters: AudienceFilters, limit: number, cursor: AudienceCursor | null): Promise<AudienceList> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const values: unknown[] = [site.id];
    const range = rangeWhere(filters, 2);
    values.push(...range.values);
    const search = searchWhere(kind, filters.search, values.length + 1);
    values.push(...search.values);
    const countValues: unknown[] = [site.id, ...range.values, ...search.values];
    const cursorSql = cursor ? ` AND (created_at, id) < ($${values.length + 1}::timestamptz, $${values.length + 2}::uuid)` : '';
    if (cursor) values.push(cursor.createdAt, cursor.id);
    const hasTags = kind === 'subscribers' && Boolean(filters.tags?.length);
    const tagsSql = hasTags ? ` AND tags @> $${values.length + 1}::text[]` : '';
    const countTagsSql = hasTags ? ` AND tags @> $${countValues.length + 1}::text[]` : '';
    if (hasTags) { values.push(filters.tags); countValues.push(filters.tags); }
    const where = `site_id = $1 ${kind === 'subscribers' ? 'AND deleted_at IS NULL' : ''}${range.sql}${search.sql}${cursorSql}${tagsSql}`;
    const [rows, count] = await Promise.all([
      pool.query<AudienceRow>(`SELECT * FROM ${table(kind)} WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${safeLimit + 1}`, values),
      pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM ${table(kind)} WHERE site_id = $1 ${kind === 'subscribers' ? 'AND deleted_at IS NULL' : ''}${range.sql}${search.sql}${countTagsSql}`, countValues)
    ]);
    const page = rows.rows.slice(0, safeLimit);
    const last = page[page.length - 1];
    return { records: page.map((row) => response(kind, row)), total: Number(count.rows[0]?.total || 0), hasMore: rows.rows.length > safeLimit, nextCursor: rows.rows.length > safeLimit && last ? encodeCursor({ createdAt: new Date(last.created_at).toISOString(), id: last.id }) : null };
  }

  async function metrics(site: AudienceSite, filters: AudienceFilters): Promise<AudienceMetrics> {
    const range = rangeWhere(filters, 2);
    const values = [site.id, ...range.values];
    const visitorValues = [site.id, filters.from || null, filters.to || null];
    const [subscribers, active, newSubscribers, submissions, newSubmissions, visitors] = await Promise.all([
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM audience_subscribers WHERE site_id = $1 AND deleted_at IS NULL${range.sql}`, values),
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM audience_subscribers WHERE site_id = $1 AND deleted_at IS NULL AND status = 'subscribed'${range.sql}`, values),
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM audience_subscribers WHERE site_id = $1 AND deleted_at IS NULL AND created_at >= now() - interval '30 days'${range.sql}`, values),
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM form_submissions WHERE site_id = $1${range.sql}`, values),
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM form_submissions WHERE site_id = $1 AND created_at >= now() - interval '30 days'${range.sql}`, values),
      // Visitor metrics come from the bounded visitor-day rollup. Raw event
      // history is never scanned from an HTTP-facing audience query.
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM analytics_visitor_days
        WHERE site_id = $1
          AND day BETWEEN COALESCE($2::date, current_date - interval '399 days')
                      AND COALESCE($3::date, current_date)`, visitorValues)
    ]);
    const number = (result: { rows: { count: string }[] }) => Number(result.rows[0]?.count || 0);
    const subscriberCount = number(subscribers); const visitorCount = number(visitors);
    return { subscribers: subscriberCount, activeSubscribers: number(active), newSubscribers: number(newSubscribers), submissions: number(submissions), newSubmissions: number(newSubmissions), uniqueVisitors: visitorCount, conversionRate: visitorCount ? Number(((subscriberCount / visitorCount) * 100).toFixed(2)) : null };
  }

  async function createSubscriber(site: AudienceSite, input: { email: string; name?: string; source?: string; tags?: string[]; consentStatus?: string; consentSource?: string }) {
    const result = await pool.query<AudienceRow>(
      `INSERT INTO audience_subscribers (account_id, site_id, email, email_normalized, name, source, tags, consent_status, consent_source, consented_at)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, CASE WHEN $7 = 'granted' THEN now() END)
       ON CONFLICT (site_id, email_normalized) WHERE deleted_at IS NULL
       DO UPDATE SET name = COALESCE(EXCLUDED.name, audience_subscribers.name), source = EXCLUDED.source, tags = EXCLUDED.tags,
         consent_status = EXCLUDED.consent_status, consent_source = EXCLUDED.consent_source,
         unsubscribed_at = NULL, status = 'subscribed', updated_at = now()
       RETURNING *`, [site.accountId, site.id, input.email.trim().toLowerCase(), input.name || null, input.source || 'form', input.tags || [], input.consentStatus || 'unknown', input.consentSource || null]
    );
    return response('subscribers', result.rows[0]);
  }

  async function createSubmission(site: AudienceSite, input: { name: string; email: string; subject: string; message: string; source?: string; attribution?: Record<string, unknown>; consentStatus?: string; idempotencyKey: string }) {
    const result = await pool.query<AudienceRow>(
      `INSERT INTO form_submissions (account_id, site_id, form_key, submitter_email, payload, status, idempotency_key, retention_until, source, attribution, consent_status, consented_at)
       VALUES ($1, $2, 'contact', $3, $4::jsonb, 'received', $5, now() + interval '2 years', $6, $7::jsonb, $8, CASE WHEN $8 = 'granted' THEN now() END)
       ON CONFLICT (site_id, idempotency_key) DO UPDATE SET updated_at = form_submissions.updated_at
       RETURNING *`, [site.accountId, site.id, input.email.trim().toLowerCase(), JSON.stringify({ fullName: input.name, email: input.email, subject: input.subject, message: input.message }), input.idempotencyKey, input.source || 'public_form', JSON.stringify(input.attribution || {}), input.consentStatus || 'unknown']
    );
    return response('submissions', result.rows[0]);
  }

  async function update(kind: AudienceKind, site: AudienceSite, id: string, status: string) {
    const dbStatus = kind === 'subscribers' ? (status === 'active' ? 'subscribed' : 'unsubscribed') : (status === 'new' ? 'received' : status === 'read' ? 'processed' : status);
    const result = await pool.query<AudienceRow>(`UPDATE ${table(kind)} SET status = $1, updated_at = now(), unsubscribed_at = CASE WHEN $1 = 'unsubscribed' THEN now() ELSE unsubscribed_at END WHERE id = $2 AND site_id = $3${kind === 'subscribers' ? ' AND deleted_at IS NULL' : ''} RETURNING *`, [dbStatus, id, site.id]);
    return result.rows[0] ? response(kind, result.rows[0]) : null;
  }

  async function remove(kind: AudienceKind, site: AudienceSite, id: string) {
    const result = kind === 'subscribers'
      ? await pool.query(`UPDATE audience_subscribers SET deleted_at = now(), updated_at = now() WHERE id = $1 AND site_id = $2 AND deleted_at IS NULL`, [id, site.id])
      : await pool.query(`DELETE FROM form_submissions WHERE id = $1 AND site_id = $2`, [id, site.id]);
    return result.rowCount === 1;
  }

  async function exportAll(kind: AudienceKind, site: AudienceSite, filters: AudienceFilters) {
    const records: Record<string, unknown>[] = [];
    let cursor: AudienceCursor | null = null;
    do {
      const page = await list(kind, site, filters, 100, cursor);
      records.push(...page.records);
      cursor = page.hasMore ? decodeAudienceCursor(page.nextCursor) : null;
    } while (cursor);
    return records;
  }

  return { findSiteByHandle, findOwnedSite, list, exportAll, metrics, createSubscriber, createSubmission, update, remove };
}
