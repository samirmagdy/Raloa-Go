const PRIMARY_HOSTS = new Set(['raloa.app', 'www.raloa.app']);

/**
 * Builds a public site URL without leaking a production hostname into local,
 * staging, preview, or custom-host environments.
 */
export function publicSiteUrl(handle: string, origin?: string, customDomain?: string): string {
  const cleanHandle = handle.replace(/^@/, '').trim().toLowerCase();
  if (!cleanHandle) return '';

  if (customDomain?.trim()) {
    try {
      const domain = customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
      return `https://${domain}/@${encodeURIComponent(cleanHandle)}`;
    } catch {
      // Use the current origin when a persisted domain is malformed.
    }
  }

  if (origin) {
    try {
      const parsed = new URL(origin);
      const base = PRIMARY_HOSTS.has(parsed.hostname) ? 'https://raloa.app' : parsed.origin;
      return `${base}/@${encodeURIComponent(cleanHandle)}`;
    } catch {
      // Fall through to the canonical production URL for server-side callers.
    }
  }

  return `https://raloa.app/@${encodeURIComponent(cleanHandle)}`;
}
