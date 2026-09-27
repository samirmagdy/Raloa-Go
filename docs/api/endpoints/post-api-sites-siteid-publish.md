---
id: post-api-sites-siteid-publish
method: POST
path: /api/sites/*/publish
status: planned
auth: bearer
source: server/http/controllers/sites-controller.ts
verified_by:
updated: 2026-09-27
---

# `POST /api/sites/:siteId/publish`

Publishes the validated Studio draft as a new immutable publication snapshot. The request is tenant-scoped and may include `expectedRevision` for optimistic concurrency. The public renderer reads the new snapshot only after the transaction commits.

## Summary

Studio calls this endpoint when the creator explicitly publishes the current draft.

## Request

```json
{ "expectedRevision": 12 }
```

## Response

Returns `{ "site": { ... }, "publicationVersion": number }` on success.

## Errors

`401` authentication required; `404` site or profile not found; `400` invalid content or publish requirements; `409` publication conflict; `503` versioned publication unavailable.

## Evidence

Pending staging verification after the PostgreSQL site cutover cohort is selected.

## Frontend wiring

- **Called by:** Studio publish action.
- **Loading:** disable publish controls while the transaction is running.
- **Retry:** retry only after refreshing on `409`.
