# Integration token boundary

`createOAuthTokenService` is the only application service allowed to decrypt or
refresh provider credentials. Controllers and frontend clients receive public
connection metadata (`provider`, `scopes`, and `state`) and never receive an
access token or refresh token.

The Firestore implementation stores encrypted credentials in
`oauth_connections`. PostgreSQL uses the `integrations` table with encrypted
token columns, provider/site ownership, scope allowlists, connection state,
refresh locks, token versions, and revocation timestamps.

Provider adapters contain OAuth-provider details only. They are injected at the
composition root and are called by the service through `withAccessToken`, which
handles expiry checks, refresh locking, token rotation, reauthorization state,
and revocation. New providers must define the smallest required scope list and
must not expose raw credentials through an HTTP route.
