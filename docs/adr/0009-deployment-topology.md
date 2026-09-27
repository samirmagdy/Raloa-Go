# ADR-0009: Cloud Run modular deployment topology

- Status: Accepted
- Date: 2026-09-27

## Context

Public rendering, authenticated Studio/API traffic, and background workers have different ingress, scaling, and security requirements, but the platform is not ready for independently owned microservices.

## Decision

Deploy operational Cloud Run roles for public web, Studio/API, and background workers from a shared compatibility image and shared release pipeline. Keep one modular-monolith codebase and composition root until independent ownership or scaling is proven.

## Alternatives

Deploy one undifferentiated service, split every domain into microservices, or adopt Kubernetes before workload evidence exists.

## Tradeoffs

Role-specific deployments improve isolation and scaling while preserving a single release contract. The shared image means releases remain coupled until a measured extraction is justified.

## Migration impact

Use checked-in manifests, staged gates, immutable images, protected environments, provider smoke tests, and per-service rollback. Public Next.js and worker extraction remain optional follow-on boundaries.

## Reversal strategy

Route traffic back to the prior Cloud Run revisions or temporarily collapse roles to the compatibility service. Preserve API contracts, queues, migration state, and secrets boundaries during rollback.
