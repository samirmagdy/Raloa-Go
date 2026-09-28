-- These are bounded query templates for the R2 SQL open beta.
-- Replace `raloa_analytics.raw_events` with the table name returned by the
-- R2 Data Catalog after the catalog is created. Do not run against a guessed
-- warehouse name in production.

-- Daily page views and clicks for one site and bounded date range.
SELECT
  date_trunc('day', occurred_at) AS day,
  count_if(event_type = 'page_view') AS page_views,
  count_if(event_type = 'link_click') AS clicks
FROM raloa_analytics.raw_events
WHERE site_id = '${SITE_ID}'
  AND occurred_at >= TIMESTAMP '${FROM_UTC}'
  AND occurred_at < TIMESTAMP '${TO_UTC}'
GROUP BY 1
ORDER BY 1
LIMIT 400;

-- Top links for a bounded report.
SELECT
  payload.linkId AS link_id,
  count(*) AS clicks
FROM raloa_analytics.raw_events
WHERE event_type = 'link_click'
  AND site_id = '${SITE_ID}'
  AND occurred_at >= TIMESTAMP '${FROM_UTC}'
  AND occurred_at < TIMESTAMP '${TO_UTC}'
GROUP BY 1
ORDER BY clicks DESC
LIMIT 100;
