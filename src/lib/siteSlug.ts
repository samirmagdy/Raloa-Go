export const SITE_SLUG_MIN_LENGTH = 3;
export const SITE_SLUG_MAX_LENGTH = 30;

// These names overlap with application routes and infrastructure endpoints. They
// must not become public site slugs, even when no creator currently owns them.
export const RESERVED_SITE_SLUGS = new Set([
  'admin', 'api', 'app', 'assets', 'about', 'billing', 'contact', 'dashboard',
  'favicon', 'features', 'guides', 'help', 'legal', 'login', 'pricing',
  'public', 'raloa', 'register', 'robots', 'root', 'security', 'settings',
  'sitemap', 'static', 'studio', 'support', 'team', 'terms', 'u', 'www'
 ]);

export function normalizeSiteSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, SITE_SLUG_MAX_LENGTH);
}

export function validateSiteSlug(value: unknown): { valid: boolean; slug: string; code?: 'required' | 'format' | 'reserved' } {
  const slug = normalizeSiteSlug(value);
  if (!slug) return { valid: false, slug, code: 'required' };
  if (!new RegExp(`^[a-z0-9_-]{${SITE_SLUG_MIN_LENGTH},${SITE_SLUG_MAX_LENGTH}}$`).test(slug)) {
    return { valid: false, slug, code: 'format' };
  }
  if (RESERVED_SITE_SLUGS.has(slug)) return { valid: false, slug, code: 'reserved' };
  return { valid: true, slug };
}
