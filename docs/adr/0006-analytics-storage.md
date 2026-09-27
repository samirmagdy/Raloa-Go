# ADR-0006: Separate analytics storage from transactions

- Status: Accepted
- Date: 2026-09-27

## Context

Creator dashboards need bounded, low-latency aggregates while raw events can grow without bound and have analytical query patterns.

## Decision

Store operational rollups needed by Studio in PostgreSQL where appropriate. Append and deduplicate raw history asynchronously in BigQuery or an equivalent analytical store.

## Alternatives

Scan raw events in PostgreSQL, keep all history in Firestore, or send raw events directly to a third-party analytics product.

## Tradeoffs

The pipeline introduces ingestion lag, schema/version management, and two storage systems, but protects transactional workloads and makes dashboard latency predictable.

## Migration impact

Validate and deduplicate events, enqueue ingestion, maintain bounded rollups, and migrate historical events with checkpoints and reconciliation.

## Reversal strategy

Keep rollups as the Studio read contract, pause analytical ingestion safely, and replay the raw event log into a replacement analytical sink. Do not make dashboard requests scan the transactional database as an emergency default.
