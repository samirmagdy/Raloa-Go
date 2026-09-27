---
id: delete-api-creator-audience-kind-id
method: DELETE
path: /api/creator/audience/{kind}/{id}
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-audience.ts
updated: 2026-09-27
---

# `DELETE /api/creator/audience/{kind}/{id}`

Permanently deletes an owner-scoped subscriber or contact submission after checking the record's authenticated creator ownership. Returns `204` on success and `401`, `404`, or `503` on failure.

## Summary

Studio permanently removes an audience record owned by the authenticated creator.

## Request

Path `kind` is `subscribers` or `submissions`; `id` is the persisted document ID. No body is accepted.

## Response

`204` returns an empty body after deletion.

## Errors

`400` invalid kind; `401` missing authentication; `404` missing or foreign record; `503` persistence unavailable.

## Evidence

```bash
curl -sS -X DELETE -H "Authorization: Bearer <creator-token>" http://localhost:3000/api/creator/audience/subscribers/record-id
```

The unauthenticated contract test returns `401`; authenticated integration requires Firebase credentials.

## Frontend wiring

- **Called by**: delete controls in `StudioAudienceTab`
- **Trigger**: confirmed delete action
- **Retry**: safe after a successful `204`; a repeated delete returns `404`
