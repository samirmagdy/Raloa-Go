---
id: get-api-media
method: GET
path: /api/media
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-media.ts
updated: 2026-09-27
---

# GET /api/media

Lists ready media assets owned by the authenticated creator for the required siteId query parameter. Success is 200 with a media array. Errors are 400, 401, 404, and 503.

Called by Studio media management. Loading, empty, and error states are distinct; failures are not treated as an empty list.

## Summary

Lists authenticated creator-owned media assets.

## Request

Requires the `siteId` query parameter and authenticated session.

## Response

Success status: `200 OK`; returns `{ "media": [] }`.

## Errors

Returns `400`, `401`, `404`, or `503` with the standard structured error envelope.

## Evidence

`test-media.ts` verifies the authentication boundary; authenticated staging verification is performed by `test:integration:staging`.

```bash
curl -sS -H "Authorization: Bearer <creator-token>" "https://staging.example/api/media?siteId=<site-id>"
```

## Frontend wiring

Studio media controls display loading, empty, and service-error states.
