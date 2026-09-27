---
id: post-api-media-upload
method: POST
path: /api/media/upload
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-media.ts
updated: 2026-09-27
---

# POST /api/media/upload

Authenticated Studio uploads an owned site's image media. The server validates purpose, MIME type, dimensions, size, entitlements, ownership, optimizes the image, creates a thumbnail, and persists the media asset.

Multipart fields are siteId, purpose, and file. Success is 201 with a media object containing id, src, thumbnail, and status=ready. Errors are 400, 401, 403, 404, 415, 422, and 503.

Called by Studio media controls with upload progress and explicit error state. Uploads are not silently retried because a new asset may be created.

## Summary

Creates an optimized owned media asset.

## Request

Requires authenticated multipart form data with `siteId`, `purpose`, and `file`.

## Response

Success status: `201 Created`; returns the persisted media object.

## Errors

Returns `400`, `401`, `403`, `404`, `415`, `422`, or `503` with the standard error envelope.

## Evidence

`test-media.ts` verifies the authentication boundary; authenticated staging verification is performed by `test:integration:staging`.

```bash
curl -sS -X POST -H "Authorization: Bearer <creator-token>" -F siteId=<site-id> -F purpose=gallery -F file=@image.png "https://staging.example/api/media/upload"
```

## Frontend wiring

Studio upload controls show progress, success, and failure states.
