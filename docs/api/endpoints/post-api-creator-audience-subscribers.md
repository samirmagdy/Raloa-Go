---
id: post-api-creator-audience-subscribers
method: POST
path: /api/creator/audience/subscribers
status: implemented
auth: bearer | session
source: server.ts
verified_by: test-audience.ts
updated: 2026-09-27
---

# `POST /api/creator/audience/subscribers`

Creates or updates a subscriber owned by the authenticated creator and requested site. The server validates the email and derives the record identity from creator, site, and normalized email; client IDs are ignored.

Body: `{ "siteHandle": string, "email": string, "source"?: string }`.

Returns `201` with `data` containing the persisted record. Returns `401`, `400`, `404`, or `503` for authentication, validation, ownership, or persistence failures.

## Summary

Studio adds a creator-owned subscriber using a server-derived idempotent record key.

## Request

JSON body: `{ "siteHandle": string, "email": string, "source"?: string }`. Email is normalized and validated server-side.

## Response

`201` returns `{ "data": { "id": string, "email": string, "source": string, "status": "active", "createdAt": string } }`.

## Errors

`400` invalid email; `401` missing authentication; `404` site not owned; `503` persistence unavailable.

## Evidence

```bash
curl -sS -X POST -H "Authorization: Bearer <creator-token>" -H 'Content-Type: application/json' -d '{"siteHandle":"creator","email":"person@example.com"}' http://localhost:3000/api/creator/audience/subscribers
```

The unauthenticated contract test returns `401`; authenticated integration requires Firebase credentials.

## Frontend wiring

- **Called by**: Studio Add subscriber dialog
- **Trigger**: form submit
- **Retry**: safe for the same creator/site/email because the server derives a deterministic document ID
