import http from 'node:http';

// SEO contract tests intentionally use the explicit non-production fixture seam.
// Production fallback behaviour remains covered separately by test-public-fallback.ts.
process.env.ENABLE_DEMO_FIXTURES = 'true';
const { default: app } = await import('./server');

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(3102, '127.0.0.1', resolve));
const baseUrl = 'http://127.0.0.1:3102';

function one(html: string, pattern: RegExp, label: string): string {
  const matches = html.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`${label} expected once, found ${matches.length}`);
  return matches[0];
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

try {
  const home = await (await fetch(`${baseUrl}/`)).text();
  one(home, /<title>[^<]+<\/title>/g, 'homepage title');
  one(home, /<link rel="canonical" href="[^"]+" \/>/g, 'homepage canonical');
  one(home, /<meta name="description" content="[^"]+" \/>/g, 'homepage description');
  one(home, /<meta property="og:url" content="[^"]+" \/>/g, 'homepage og:url');
  one(home, /<meta name="twitter:card" content="[^"]+" \/>/g, 'homepage twitter card');
  const homeSchemas = [...home.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  assert(homeSchemas.length >= 1 && homeSchemas.every((schema) => schema['@context'] === 'https://schema.org'), 'homepage JSON-LD must be valid Schema.org JSON');

  const profileResponse = await fetch(`${baseUrl}/@elena`);
  const profile = await profileResponse.text();
  assert(profileResponse.status === 200, 'known public profile must return 200');
  assert(profile.includes('<meta name="robots" content="index, follow" />'), 'public profile must be indexable');
  assert(profile.includes('<link rel="canonical" href="https://raloa.app/@elena" />'), 'public profile canonical must use its public URL');
  assert(!profile.includes('hreflang="en" href="https://raloa.app/"'), 'profile must not retain homepage hreflang');
  const profileSchemas = [...profile.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  assert(profileSchemas.some((schema) => schema['@type'] === 'ProfilePage'), 'public profile must include ProfilePage JSON-LD');

  const customResponse = await fetch(`${baseUrl}/`, { headers: { 'x-forwarded-host': 'portfolio.johndoe.com' } });
  const custom = await customResponse.text();
  assert(customResponse.status === 200, 'active custom domain must return 200');
  assert(custom.includes('<link rel="canonical" href="https://portfolio.johndoe.com/" />'), 'custom domain must canonicalize to its own root');
  assert(custom.includes('<meta property="og:url" content="https://portfolio.johndoe.com/" />'), 'custom domain og:url must match canonical');

  const notFoundResponse = await fetch(`${baseUrl}/@does-not-exist`);
  const notFound = await notFoundResponse.text();
  assert(notFoundResponse.status === 404 && notFound.includes('noindex, nofollow'), 'unknown profiles must be non-indexable 404s');

  const robots = await (await fetch(`${baseUrl}/robots.txt`)).text();
  assert(robots.includes('Disallow: /studio/') && robots.includes('Disallow: /api/') && robots.includes('Sitemap: https://raloa.app/sitemap.xml'), 'robots.txt must protect private routes and advertise sitemap');

  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  const sitemap = await sitemapResponse.text();
  assert(Boolean(sitemapResponse.headers.get('content-type')?.includes('application/xml')) && sitemap.includes('<urlset') && sitemap.includes('https://raloa.app/@elena') && !sitemap.includes('/studio'), 'sitemap must contain crawlable public URLs only');

  console.log('PASS: SSR metadata, profile/custom-domain canonicals, JSON-LD, indexability, robots, and sitemap');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
