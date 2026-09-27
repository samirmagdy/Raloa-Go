# Public-page performance domain

Public creator pages are a separate high-read delivery workload. The server resolves published
content and metadata before sending the HTML shell, then the browser loads only the lazy public
profile chunk. Studio remains a separate lazy chunk and is not required to render a public profile.

## Performance rules

- Server-render meaningful title, description, canonical URL, robots state, creator name, bio, and
  social image metadata from the published configuration.
- Cache only normalized published payloads and verified domain resolution at the public boundary;
  drafts, Studio state, authorization, and entitlements are never public-cacheable.
- Keep the public profile component behind its own `public-profile` chunk. Studio is already loaded
  through the `studio` lazy chunk and must not be imported by public rendering code.
- Load video/music embeds with `iframe loading="lazy"`; do not block first paint on third-party
  providers.
- Use thumbnail/CDN URLs for gallery previews, responsive widths, `loading="lazy"`, and asynchronous
  image decoding. Load full-size media only in the user-opened viewer.
- Serve hashed static assets with immutable CDN caching and HTML with short public cache plus stale
  revalidation. Publish/update/unpublish invalidates the published payload and metadata keys.

## Boundary and budgets

The public API response is a normalized public-page contract and must not include account profiles,
billing state, private integrations, raw provider credentials, or Studio-only configuration. Public
page performance must be measured separately from Studio using FCP, LCP, CLS, transfer size, cache
hit ratio, and third-party embed cost.

The current route keeps `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` for published
profiles and uses the public-site cache adapter. A future Next.js public renderer can consume the
same contract and cache policy without moving Studio or changing domain services.
