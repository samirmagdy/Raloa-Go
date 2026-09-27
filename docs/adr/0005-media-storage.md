# ADR-0005: Provider-neutral media storage

- Status: Accepted
- Date: 2026-09-27

## Context

Uploads need ownership, lifecycle state, originals, processed variants, thumbnails, cleanup, and CDN delivery. Provider behavior must not leak into Studio components.

## Decision

Use a media service with storage adapters for Firebase Storage and Cloudflare R2. PostgreSQL owns metadata and lifecycle; asynchronous workers create processed assets and deterministic URLs.

## Alternatives

Put storage calls directly in the frontend, standardize on Firebase forever, or store binary data in PostgreSQL.

## Tradeoffs

Adapters and asynchronous processing add state transitions and cleanup jobs, but allow provider changes, CDN optimization, and safe retry without rewriting product code.

## Migration impact

Persist upload metadata before processing, retain provider object IDs, backfill metadata, and migrate assets through checksummed/verified copy jobs.

## Reversal strategy

Select the prior storage adapter, keep metadata and old objects addressable, and replay failed processing jobs. Do not delete originals until the retention window and reconciliation report pass.
