---
id: patch-api-creator-audience-kind-id
method: PATCH
path: /api/creator/audience/{kind}/{id}
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-audience.ts
updated: 2026-09-27
---

# `PATCH /api/creator/audience/{kind}/{id}`

Updates only the status of an audience record after verifying that its `creatorUserId` belongs to the authenticated creator. `kind` is `subscribers` or `submissions`; subscriber statuses are `active|unsubscribed`, submission statuses are `new|read|archived`.

Body: `{ "status": string }`. Returns `200` with the updated record, or `400`, `401`, `404`, or `503`.

## Summary

Studio changes an owner-scoped subscriber or form submission status.

## Request

Path `kind` is `subscribers` or `submissions`; body is `{ "status": string }` with the kind-specific allowed values.

## Response

`200` returns `{ "data": <updated audience record> }`.

## Errors

`400` invalid kind/status; `401` missing authentication; `404` missing or foreign record; `503` persistence unavailable.

## Evidence

```bash
curl -sS -X PATCH -H "Authorization: Bearer <creator-token>" -H 'Content-Type: application/json' -d '{"status":"read"}' http://localhost:3000/api/creator/audience/submissions/record-id
```

The unauthenticated contract test returns `401`; authenticated integration requires Firebase credentials.

## Frontend wiring

- **Called by**: status selectors in `StudioAudienceTab`
- **Trigger**: status selection
- **Retry**: safe because only the requested status is merged after ownership verification
