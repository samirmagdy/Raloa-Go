---
id: get-api-creator-audience-export
method: GET
path: /api/creator/audience/export
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-audience.ts
updated: 2026-09-27
---

# `GET /api/creator/audience/export`

Downloads the authenticated creator's owner-scoped subscribers or submissions after applying the same server-side filters as the list endpoint. Use `type=subscribers|submissions`, `format=csv|json`, optional `siteHandle`, `search`, `status`, `from`, and `to`.

Returns an attachment with `200`; no client-supplied record data is trusted. Returns `400`, `401`, `404`, or `503` as appropriate.

## Summary

Studio downloads filtered owner-scoped audience data in CSV or JSON format.

## Request

Query parameters include `type`, `format`, `siteHandle`, `search`, `status`, `from`, and `to`. The server resolves the site from the authenticated creator.

## Response

`200` returns a `text/csv` or `application/json` attachment containing only persisted records belonging to the creator's site.

## Errors

`400` invalid type/filter; `401` missing authentication; `404` site not owned; `503` persistence or export failure.

## Evidence

```bash
curl -sS -OJ -H "Authorization: Bearer <creator-token>" "http://localhost:3000/api/creator/audience/export?type=subscribers&format=csv"
```

The unauthenticated contract test returns `401`; authenticated integration requires Firebase credentials.

## Frontend wiring

- **Called by**: CSV and JSON export buttons in `StudioAudienceTab`
- **Trigger**: explicit export click
- **Loading/error state**: controls disable during download and failures appear in the error banner
