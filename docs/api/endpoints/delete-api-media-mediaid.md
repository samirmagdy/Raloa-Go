---
id: delete-api-media-mediaid
method: DELETE
path: /api/media/*
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-media.ts
updated: 2026-09-27
---

# DELETE /api/media/:mediaId

Deletes an owned media asset when it is not referenced by the site or products. siteId is required in the query. Success is 204. Errors are 401, 404, 409 when the asset is in use, and 503 for storage failure.

## Summary

Deletes an unused owned media asset and its storage objects.

## Request

Requires `mediaId`, `siteId`, and authenticated session.

## Response

Success status: `204 No Content`.

## Errors

Returns `401`, `404`, `409`, or `503` with the standard error envelope.

## Evidence

`test-media.ts` verifies the authentication boundary; authenticated staging verification is performed by `test:integration:staging`.

```bash
curl -sS -X DELETE -H "Authorization: Bearer <creator-token>" "https://staging.example/api/media/<media-id>?siteId=<site-id>"
```

## Frontend wiring

Studio deletion displays confirmation, loading, success, and failure states.
