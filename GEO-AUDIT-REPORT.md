# GEO Audit Report: RALOA

**Audit Date:** 2026-09-24  
**URL:** https://raloa.app/ (production URL not reachable from this workspace; audit validated the local production server)  
**Business Type:** SaaS mini-site builder  
**Pages Analyzed:** 7 public routes plus `robots.txt`, `sitemap.xml`, and `llms.txt`

## Executive Summary

**Overall GEO Score: 56/100 (Fair)**

RALOA has a good marketing foundation, clean public routes, route-aware metadata, strong visual assets, and a clear Free/Pro/Studio product model. The most important discovery problems were that the raw HTML exposed almost no crawlable page content and `/llms.txt` incorrectly fell through to the SPA. Those are now fixed with a no-JavaScript content fallback, server-rendered entity JSON-LD, a real `llms.txt`, crawler directives, and route-aware canonical metadata.

The remaining score ceiling is caused by deployment-dependent items: no verified live-domain crawl, no field Core Web Vitals data, no confirmed external brand authority, and the main JavaScript bundle remaining large.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---:|---:|---:|
| AI Citability | 61/100 | 25% | 15.3 |
| Brand Authority | 32/100 | 20% | 6.4 |
| Content E-E-A-T | 54/100 | 20% | 10.8 |
| Technical GEO | 74/100 | 15% | 11.1 |
| Schema & Structured Data | 78/100 | 10% | 7.8 |
| Platform Optimization | 36/100 | 10% | 3.6 |
| **Overall GEO Score** |  |  | **56/100** |

## Critical Issues

None remain in the local production build. Before launch, verify the same results against `https://raloa.app/` after DNS and Cloud Run deployment.

## High Priority Issues

1. **Live-domain validation is still required.** Confirm HTTPS, redirects, headers, sitemap, `llms.txt`, and public creator routes on the deployed domain.
2. **Field performance is unmeasured.** The build still reports a large JavaScript chunk; collect Lighthouse and CrUX data after deployment and lazy-load Studio/analytics/template modules if needed.
3. **External authority is unverified.** Add only real RALOA social/company URLs to `sameAs` after those profiles exist and are consistent.
4. **Content depth is still thin for a SaaS site.** Add focused guides for mini-sites, creator conversion, custom domains, Arabic RTL publishing, analytics, and plan comparisons.

## Medium Priority Issues

- FAQ JSON-LD is client-injected for the interactive section; the homepage fallback now contains crawlable FAQ text, but route-specific FAQ schema should be server-rendered if FAQ becomes a standalone page.
- Inner routes share the application shell and do not yet have fully server-rendered page bodies; the SSR fallback provides meaningful headings and links, but dedicated server-rendered landing copy would improve citability.
- BreadcrumbList schema is not present on inner routes.
- Hreflang is complete for the homepage but should be extended consistently to every localized public route when Arabic route variants are finalized.

## Low Priority Issues

- Add an IndexNow key and submission workflow for Bing freshness.
- Add a public changelog or dated guide pages to create freshness signals.
- Add verified company/contact details and editorial ownership to strengthen trust signals.

## Category Deep Dives

### AI Citability (61/100)

Strong: concise value proposition, explicit pricing facts, FAQ answers, plan descriptions, and a new `llms.txt`. Weak: most interactive content is still client-rendered, and the site has limited standalone explanatory pages that can be cited independently.

### Brand Authority (32/100)

No public-domain or third-party authority crawl was available in this environment. The code contains social link placeholders, so no external profile was treated as verified or added to schema.

### Content E-E-A-T (54/100)

The product is clearly described and testimonials provide experience signals. The site does not yet expose a named company/team, author credentials, source citations, case studies with verifiable outcomes, or a dated knowledge base. Avoid unsupported claims such as “thousands” unless they are backed by production data.

### Technical GEO (74/100)

Local checks passed for 200 responses, metadata, canonical URLs, sitemap, AI crawler access, security headers, and raw fallback content. The score is reduced for unverified live HTTPS/CDN/CWV data, the large JavaScript bundle, and partial rather than full SSR.

### Schema & Structured Data (78/100)

The server-rendered homepage now exposes valid JSON-LD for Organization, WebSite, and SoftwareApplication, with `@id`, logo, offers, feature list, and `knowsAbout`. Missing: verified `sameAs`, BreadcrumbList, and server-rendered FAQ schema.

### Platform Optimization (36/100)

Platform presence cannot be confirmed from the local repository. The implementation now supports discovery by GPTBot, OAI-SearchBot, Googlebot, Bingbot, ClaudeBot, PerplexityBot, and other major crawlers.

## Implemented Fixes

- Added `llms.txt` at the domain root and an Express endpoint returning `text/plain`.
- Added server-rendered Organization, WebSite, and SoftwareApplication JSON-LD.
- Added crawlable no-JavaScript headings, navigation, pricing facts, and FAQ content.
- Added canonical, robots, author, Open Graph URL/site/locale metadata.
- Added route-specific descriptions and canonicals for public marketing routes.
- Added AI crawler allow rules, private-route exclusions, sitemap reference, and Content-Signal declaration.
- Added `Permissions-Policy` and removed invalid `X-Frame-Options: ALLOWALL`.
- Added `/contact` to both sitemap implementations.

## Quick Wins

1. Verify the production URL with Google Search Console and Bing Webmaster Tools.
2. Publish only real RALOA social profiles and add them to `sameAs`.
3. Add two detailed guides per month with named authors and update dates.
4. Run Lighthouse at 320px, 375px, 430px, 768px, 1280px, and 1440px.
5. Submit the sitemap and validate JSON-LD with Schema.org Validator.

## 30-Day Action Plan

### Week 1: Production verification

- [ ] Deploy and fetch every public route from `https://raloa.app`.
- [ ] Verify redirects, certificates, headers, sitemap, and `llms.txt`.

### Week 2: Content authority

- [ ] Publish creator workflow and custom-domain guides.
- [ ] Add named company/team ownership and support details.

### Week 3: Performance

- [ ] Measure LCP, INP, CLS, and TTFB in production.
- [ ] Split/lazy-load large Studio, analytics, and template modules.

### Week 4: Distribution

- [ ] Verify social/company profiles and add accurate `sameAs` links.
- [ ] Submit sitemap, configure IndexNow, and monitor branded citations.

## Appendix: Pages Analyzed

| URL | Title | GEO Issues |
|---|---|---:|
| `/` | RALOA — Beautiful Mini-Sites for Creators, Freelancers & Businesses | 2 |
| `/templates` | All Templates — RALOA Design Gallery | 2 |
| `/features` | Creator Toolkit & Features — RALOA | 2 |
| `/pricing` | Pricing Plans — RALOA | 1 |
| `/guides` | Guides & Tutorials — RALOA | 2 |
| `/about` | About Us — RALOA | 3 |
| `/contact` | Contact Support — RALOA | 2 |
