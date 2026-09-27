---
id: post-api-media-cleanup
method: POST
path: /api/media/cleanup
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-media.ts
updated: 2026-09-27
---

# POST /api/media/cleanup

Removes old orphaned media for an owned site. The JSON body requires siteId. Success is 200 with removed count. Errors are 400, 401, 404, and 503.

## Summary

Removes safely identified orphaned media for an owned site.

## Request

Requires authenticated JSON `{ "siteId": "..." }`.

## Response

Success status: `200 OK`; returns `{ "removed": number }`.

## Errors

Returns `400`, `401`, `404`, or `503` with the standard error envelope.

## Evidence

`test-media.ts` verifies the authentication boundary; authenticated staging verification is performed by `test:integration:staging`.

```bash
curl -sS -X POST -H "Authorization: Bearer <creator-token>" -H "Content-Type: application/json" -d '{"siteId":"<site-id>"}' "https://staging.example/api/media/cleanup"
```

## Frontend wiring

Cleanup operations display explicit completion and failure states.
