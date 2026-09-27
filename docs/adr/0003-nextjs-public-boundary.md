# ADR-0003: Introduce Next.js only at the public rendering boundary

- Status: Accepted
- Date: 2026-09-27

## Context

Public creator pages need SEO metadata, server-rendered content, caching, and small client payloads. Studio is an authenticated application where Vite/React already provides productive client-side workflows.

## Decision

Allow an incremental Next.js public application for creator pages and metadata while keeping Studio on Vite. Share schemas, design tokens, normalized content, API contracts, and rendering contracts rather than forcing one runtime.

## Alternatives

Rewrite the whole frontend in Next.js, keep all public pages in the Vite SPA, or create separate unshared rendering models.

## Tradeoffs

The boundary creates two frontend deployments and shared-package discipline, but limits migration risk and lets public performance improve independently of Studio.

## Migration impact

Start with public `@handle` routes, cache published payloads, preserve existing API contracts, and use strangler routing with controlled rollout and equivalence checks.

## Reversal strategy

Disable the public-rendering flag and route public traffic back to the existing Express/Vite renderer. Shared contracts remain valid for either implementation.
