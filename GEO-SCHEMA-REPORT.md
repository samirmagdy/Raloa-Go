# GEO Schema & Structured Data Report — raloa.app

Date: 2026-09-24

## Schema Score: 78/100

## Detected Schemas

| Page | Schema Type | Format | Status | Issues |
|---|---|---|---|---|
| `/` | Organization | JSON-LD | Valid | External `sameAs` intentionally omitted until verified |
| `/` | WebSite | JSON-LD | Valid | SearchAction not used because no public search route exists |
| `/` | SoftwareApplication | JSON-LD | Valid | Offers reflect current monthly public pricing |
| Homepage FAQ | FAQPage | React JSON-LD | Valid after JS | Prefer server-rendering if FAQ becomes standalone |

## Validation Results

- JSON-LD parses successfully in the built HTML.
- Organization has name, URL, logo, description, `@id`, and `knowsAbout`.
- SoftwareApplication has name, description, category, operating system, features, and offers.
- Prices are represented in USD and match the current public monthly plan copy.
- No deprecated schema types were added.

## Missing Recommended Schemas

- BreadcrumbList for inner public routes.
- Verified `sameAs` links for real RALOA profiles.
- Server-rendered FAQPage on a dedicated FAQ URL if one is introduced.

## sameAs Audit

No profile URL was treated as verified. Placeholder social URLs in the UI were deliberately not added to structured data.

## Implementation Notes

The core entity graph is in `index.html`, which Vite copies into the production HTML and Express serves before client JavaScript runs. Validate the deployed output with Schema.org Validator and Search Console after DNS is live.
