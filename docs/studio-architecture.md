# Studio architecture boundary

Studio remains a client-rendered React/Vite application because its workload
is authenticated, interaction-heavy, and not search-indexed. SSR does not add
meaningful value to editor state, drag-and-drop composition, live previews,
modals, or authenticated settings flows.

The shared boundary is `src/shared/`. It contains framework-neutral exports for:

- domain and API types;
- content/product validation and normalization;
- design tokens and token normalization;
- public page contracts;
- a base-URL-aware public API client for browser or Next server usage.

It must not import Firebase Admin, Express, Studio contexts, browser-only
authentication state, or server repositories. Studio may continue importing the
existing modules directly while new code uses the shared facade. A future Next
public application can consume the same facade without bundling Studio.

The deployment split is intentional:

```text
Next public renderer / CDN  ->  public-site adapter  ->  Express public APIs
Vite Studio / authenticated ->  authenticated APIs   ->  domain services
```

The public renderer owns `/@handle` and eventually verified custom domains.
Studio retains `/studio`, `/dashboard`, `/analytics`, `/settings`, and auth.
No Studio feature should migrate solely for framework consistency.
