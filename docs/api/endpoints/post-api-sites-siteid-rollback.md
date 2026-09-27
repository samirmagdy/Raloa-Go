---
id: post-api-sites-siteid-rollback
method: POST
path: /api/sites/*/rollback
status: planned
auth: bearer
source: server/http/controllers/sites-controller.ts
verified_by:
updated: 2026-09-27
---

# `POST /api/sites/:siteId/rollback`

Creates a new publication version from a prior immutable snapshot while preserving all existing history.

## Summary

Studio calls this endpoint to restore a selected historical public version without mutating the historical snapshot.

## Request

```json
{ "publicationVersion": 1, "expectedPublicationVersion": 3 }
```

## Response

Returns `{ "site": { ... }, "publicationVersion": number }`.

## Errors

`400` invalid publication version; `401` authentication required; `404` site or publication version not found; `409` publication conflict; `503` versioned publication unavailable.

## Evidence

Pending staging verification after the PostgreSQL site cutover cohort is selected.

## Frontend wiring

- **Called by:** Studio publication history action.
- **Loading:** show rollback progress and disable competing publication actions.
- **Retry:** refresh the publication history after `409`.
