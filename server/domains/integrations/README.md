# Integration token boundary

`createOAuthTokenService` is the only application service allowed to decrypt or
refresh provider credentials. Controllers and frontend clients receive public
connection metadata (`provider`, `scopes`, and `state`) and never receive an
access token or refresh token.

## Encryption model

New credentials use the versioned envelope format implemented by
`server/infrastructure/crypto/envelope.ts`. Each record contains a format
version, purpose-bound AES-256-GCM ciphertext, nonce, authentication tag, and
the KMS key reference plus KMS-wrapped data-encryption key. Production requires
`INTEGRATION_KMS_KEY_NAME` and Application Default Credentials; the local
development fallback is explicitly unavailable in production.

The key reference is stored with the envelope so old records remain decryptable
during rotation. A rotation deploy changes the active KMS key reference, then a
worker reads and rewrites records transactionally. Legacy three-part ciphertexts
are read only during migration through the temporary
`INTEGRATION_LEGACY_ENCRYPTION_KEY` Secret Manager reference. Plaintext exists
only inside the trusted integration service and provider adapter call; it is
never returned by a repository, controller, event, log, or client bundle.

The Firestore implementation stores encrypted credentials in
`oauth_connections`. PostgreSQL uses the `integrations` table with encrypted
token columns, provider/site ownership, scope allowlists, connection state,
refresh locks, token versions, and revocation timestamps.

Provider adapters contain OAuth-provider details only. They are injected at the
composition root and are called by the service through `withAccessToken`, which
handles expiry checks, refresh locking, token rotation, reauthorization state,
and revocation. New providers must define the smallest required scope list and
must not expose raw credentials through an HTTP route.
