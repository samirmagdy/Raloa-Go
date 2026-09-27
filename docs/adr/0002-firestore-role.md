# ADR-0002: Limit Firestore to document/realtime strengths

- Status: Accepted
- Date: 2026-09-27

## Context

Firestore is already used by the platform and is productive for editor configuration, published document-shaped content, and realtime collaboration. It is a poor default for new cross-entity transactional workflows.

## Decision

Retain Firestore for editor/realtime and migration-only compatibility workloads. New relational transactional domains default to PostgreSQL and access Firestore only through repository adapters.

## Alternatives

Make Firestore the permanent system of record, migrate every collection immediately, or operate two permanent authorities.

## Tradeoffs

This preserves existing behavior and realtime capability but requires temporary migration adapters and reconciliation. It avoids distributed dual authority and reduces future query/consistency work.

## Migration impact

Existing domains move through backfill, shadow reads, dual writes, target-authoritative rollout, and eventual removal/read-only marking of migration collections.

## Reversal strategy

Keep the Firestore repository available throughout each migration. A feature-flag rollback returns reads/writes to the source while preserving PostgreSQL records for repair and replay.
