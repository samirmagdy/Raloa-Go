---
id: get-api-media-mediaid-url
method: GET
path: /api/media/*/url
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-media.ts
updated: 2026-09-27
---

# GET /api/media/:mediaId/url

Returns a short-lived signed URL for an owned ready asset. variant=thumbnail selects the thumbnail; the default is the original. Success is 200 with url and expiresAt. Errors are 401, 404, or 503.

## Summary

Creates a short-lived signed URL for an owned ready asset.

## Request

Requires `mediaId` and optional `variant=thumbnail`.

## Response

Success status: `200 OK`; returns `url` and `expiresAt`.

## Errors

Returns `401`, `404`, or `503` with the standard error envelope.

## Evidence

`test-media.ts` verifies the authentication boundary; authenticated staging verification is performed by `test:integration:staging`.

```bash
curl -sS -H "Authorization: Bearer <creator-token>" "https://staging.example/api/media/<media-id>/url?variant=thumbnail"
```

## Frontend wiring

Studio media controls show loading and signed-URL failure states.
