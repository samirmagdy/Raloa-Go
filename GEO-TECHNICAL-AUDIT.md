# GEO Technical SEO Audit — raloa.app

Date: 2026-09-24  
Source: local production server on `127.0.0.1:4173`; public deployment not available for live verification.

## Technical Score: 74/100

| Category | Score | Status |
|---|---:|---|
| Crawlability | 14/15 | Pass |
| Indexability | 10/12 | Pass |
| Security | 8/10 | Pass |
| URL Structure | 7/8 | Pass |
| Mobile Optimization | 8/10 | Warn |
| Core Web Vitals | 7/15 | Warn |
| Server-Side Rendering | 10/15 | Warn |
| Page Speed & Server | 10/15 | Warn |

## Evidence

- Public routes, `/robots.txt`, `/sitemap.xml`, and `/llms.txt` returned HTTP 200 locally.
- Homepage raw HTML contains title, canonical, JSON-LD, H1, navigation, and FAQ fallback content.
- Headers include HSTS, `X-Content-Type-Options`, `Referrer-Policy`, CSP, `Permissions-Policy`, and same-origin framing protection.
- `npm run build` passes but reports a JavaScript chunk above Vite's 600 kB warning threshold.
- Field LCP, INP, CLS, CDN, and live TLS checks require the deployed domain.

## Critical Issues

None locally after remediation.

## Warnings

- Main bundle needs performance measurement and likely route/module splitting.
- Full page bodies are not server-rendered; only metadata and a meaningful no-JavaScript fallback are server-rendered.
- Mobile layout and tap-target checks need browser-based QA at the release breakpoints.

## Recommendations

- Add production compression/CDN validation and immutable cache headers for hashed assets.
- Add IndexNow after DNS is live.
- Run Lighthouse and real-user monitoring after launch.

## Agent-Readiness Signals

### RFC 8288 Link Headers

Not applicable to the current standard marketing site; no public API catalog is advertised.

### Markdown Content Negotiation

Not supported; the site returns HTML for `Accept: text/markdown`. This is a forward-looking Cloudflare enhancement, not a launch blocker.

## AI Crawler Access

Major search and AI crawlers are explicitly allowed in `server.ts` and `public/robots.txt`; private application paths are excluded.
