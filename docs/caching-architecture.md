# Caching architecture

Caching is limited to stable, high-read public boundaries. The cache policy is defined in
[`server/infrastructure/cache/policy.ts`](../server/infrastructure/cache/policy.ts).

| Boundary | Key | TTL | Invalidation |
| --- | --- | ---: | --- |
| Published site payload | `public-site:v1:{normalizedHandle}` | 60s + 300s stale window at CDN | Publish, update, unpublish, handle change |
| Public metadata/SEO | `public-metadata:v1:{normalizedHandle}` | 300s + 600s stale window | Publish, update, unpublish, handle change |
| Verified domain resolution | `domain-resolution:v1:{normalizedHostname}` | 30s + 60s stale window | Domain verification/deletion and publish state changes |

Published payloads are cached only after normalized schema validation and only for public content.
The public site adapter owns cache lookup and invalidation; Studio edits, drafts, account profiles,
billing state, entitlements, permissions, OAuth tokens, and other private state are never cached by
this layer. If an authorization-sensitive result is ever cached, its key must include the complete
tenant/user scope and it must have an explicit policy review.

Publishing invalidates both the current and previous handle so slug changes cannot leave stale
public pages reachable. Domain resolution follows the same event-driven invalidation rule. Cache
misses and cache failures fall back to the source repository; cache correctness is not a security or
availability dependency.

The current process-local cache is an adapter for development and single-process operation. A
multi-instance deployment should provide the same `CacheStore` contract with Redis or an equivalent
shared cache, while CDN `Cache-Control` remains the outer public delivery cache. Private Studio
responses must use `Cache-Control: private, no-store` or equivalent response policy.
