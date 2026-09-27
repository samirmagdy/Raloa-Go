---
id: post-api-sites-siteid-unpublish
method: POST
path: /api/sites/*/unpublish
status: planned
auth: bearer
source: server/http/controllers/sites-controller.ts
verified_by:
updated: 2026-09-27
---

# `POST /api/sites/:siteId/unpublish`

Removes the current public snapshot from routing without deleting historical publication versions.

## Summary

Studio calls this endpoint when the creator removes a site from public routing.

## Request

```json
{ "expectedPublicationVersion": 3 }
```

## Response

Returns `{ "site": { ... } }` with `isPublished: false`.

## Errors

`401` authentication required; `404` site not found; `409` publication conflict; `503` versioned publication unavailable.

## Evidence

Pending staging verification after the PostgreSQL site cutover cohort is selected.

## Frontend wiring

- **Called by:** Studio unpublish action.
- **Loading:** disable publication controls until completion.
- **Retry:** refresh publication state after `409`.
