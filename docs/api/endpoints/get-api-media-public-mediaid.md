---
id: get-api-media-public-mediaid
method: GET
path: /api/media/public/*
status: implemented
auth: none
source: server.ts
verified_by: test-public-fallback.ts
updated: 2026-09-27
---

# GET /api/media/public/:mediaId

Serves media only when the owning site is persisted and published. variant=thumbnail selects the optimized thumbnail. Success is a 302 redirect to a signed URL. Unavailable or unpublished media returns 404; storage failures return 503.

## Summary

Resolves published public media without exposing unpublished assets.

## Request

Requires `mediaId` and optional `variant=thumbnail`; no authentication is accepted or required.

## Response

Success status: `302 Found` to a signed storage URL.

## Errors

Returns `404` for unavailable/unpublished media and `503` for storage failures.

## Evidence

Public fallback tests verify that unpublished data is not exposed; authenticated staging verification covers upload and deletion.

```bash
curl -sS -I "https://staging.example/api/media/public/<media-id>"
```

## Frontend wiring

Public galleries display a truthful missing-media state when resolution fails.
