---
id: get-api-creator-audience
method: GET
path: /api/creator/audience
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-audience.ts
updated: 2026-09-27
---

# `GET /api/creator/audience`

Returns records and calculated metrics for the authenticated creator's owned site. Records are filtered server-side by ownership, site, search, status, and inclusive date range.

Query parameters: `type=subscribers|submissions`, optional `siteHandle`, `search`, `status`, `from`, `to`, and `limit` (1–500).

Successful responses contain `data`, `total`, `hasMore`, `metrics`, `site`, and `dateRange`. `metrics.conversionRate` is `null` when no persisted page-view visitors exist.

Errors: `401` authentication required, `400` invalid filters, `404` site not owned/found, `503` persistence unavailable.

## Summary

Studio reads the authenticated creator's persisted audience records and server-calculated metrics.

## Request

Query filters are optional except authentication: `type`, `siteHandle`, `search`, `status`, `from`, `to`, and `limit`.

## Response

`200` returns `{ "site": {}, "data": [], "total": 0, "hasMore": false, "metrics": {}, "dateRange": {} }`. Counts and conversion are calculated from persisted records and analytics; conversion is `null` with no visitors.

## Errors

`400` invalid filters; `401` missing/invalid authentication; `404` site is not owned; `503` persistence unavailable.

## Evidence

```bash
curl -sS -H "Authorization: Bearer <creator-token>" "http://localhost:3000/api/creator/audience?type=subscribers"
```

The unauthenticated contract test returns `401`; authenticated integration requires Firebase credentials.

## Frontend wiring

- **Called by**: `StudioAudienceTab`
- **Trigger**: tab mount and filter changes
- **Loading/error state**: spinner and explicit error banner
- **Retry**: changing a filter or reopening the tab retries the request
