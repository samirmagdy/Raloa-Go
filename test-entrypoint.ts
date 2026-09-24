import app from './server';
import http from 'node:http';

async function runTests() {
  console.log('--- Starting Entry Point (Module 1) TRD Validation Suite ---');
  let passed = 0;
  let failed = 0;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, '127.0.0.1', () => resolve()));
  const baseUrl = 'http://127.0.0.1:3099';

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // AC-01: Canonical Apex Redirect for www.raloa.app
    const resWww = await fetch(`${baseUrl}/templates`, {
      headers: { 'x-forwarded-host': 'www.raloa.app' },
      redirect: 'manual',
    });
    assert(
      resWww.status === 301 && resWww.headers.get('location') === 'https://raloa.app/templates',
      'AC-01: Canonical Apex Redirect (www.raloa.app -> 301 to https://raloa.app/templates)',
      `Status: ${resWww.status}, Location: ${resWww.headers.get('location')}`
    );

    // AC-01 (cont): HTTP -> HTTPS 301 redirect
    const resHttp = await fetch(`${baseUrl}/`, {
      headers: { 'x-forwarded-host': 'raloa.app', 'x-forwarded-proto': 'http' },
      redirect: 'manual',
    });
    assert(
      resHttp.status === 301 && resHttp.headers.get('location') === 'https://raloa.app/',
      'AC-01: HTTP -> HTTPS Canonical Redirect (301 Permanent Redirect)',
      `Status: ${resHttp.status}, Location: ${resHttp.headers.get('location')}`
    );


    // FR-1.2 & NFR-4: Security & Edge Hardening Headers
    const resSec = await fetch(`${baseUrl}/`);
    const hsts = resSec.headers.get('strict-transport-security');
    const nosniff = resSec.headers.get('x-content-type-options');
    const referrer = resSec.headers.get('referrer-policy');
    const xframe = resSec.headers.get('x-frame-options');
    const csp = resSec.headers.get('content-security-policy');

    assert(
      Boolean(hsts?.includes('max-age=63072000') && hsts?.includes('includeSubDomains') && hsts?.includes('preload')),
      'FR-1.2 & NFR-4: HSTS Strict-Transport-Security header configured properly',
      hsts || 'missing'
    );

    assert(nosniff === 'nosniff', 'NFR-4: X-Content-Type-Options is nosniff', nosniff || 'missing');
    assert(
      referrer === 'strict-origin-when-cross-origin',
      'NFR-4: Referrer-Policy is strict-origin-when-cross-origin',
      referrer || 'missing'
    );
    assert(xframe === 'SAMEORIGIN', 'NFR-4: X-Frame-Options is SAMEORIGIN', xframe || 'missing');
    assert(Boolean(csp && csp.includes('default-src')), 'NFR-4: Content-Security-Policy (CSP) is set', csp || 'missing');

    // AC-02: Referral tracking capture
    const resRef = await fetch(`${baseUrl}/?ref=ALEX_PRO`);
    const cookies = resRef.headers.get('set-cookie') || '';
    assert(
      cookies.includes('_raloa_ref=ALEX_PRO') && cookies.includes('Max-Age=2592000'),
      'AC-02: Referral code (?ref=ALEX_PRO) captured into _raloa_ref cookie (30 days persistence)',
      cookies
    );

    // FR-2.2: UTM parameters parsing into _raloa_utm cookie
    const resUtm = await fetch(
      `${baseUrl}/templates?utm_source=twitter&utm_medium=social&utm_campaign=launch_q3&utm_content=banner_ad_1`
    );
    const utmCookie = resUtm.headers.get('set-cookie') || '';
    assert(
      utmCookie.includes('_raloa_utm=') &&
        decodeURIComponent(utmCookie).includes('launch_q3') &&
        decodeURIComponent(utmCookie).includes('/templates'),
      'FR-2.2: UTM parameters parsed into _raloa_utm JSON payload cookie with initial landing path',
      utmCookie
    );

    // FR-2.3: In-App Browser detection
    const resIab = await fetch(`${baseUrl}/`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 280.0.0.18.107 (iPhone14,2; iOS 16_5; en_US; en-US; scale=3.00; 1170x2532; FBAN/FBAV)',
      },
    });
    assert(
      resIab.headers.get('x-in-app-browser') === 'instagram',
      'FR-2.3: In-App Browser (Instagram FBAN/FBAV) detected',
      resIab.headers.get('x-in-app-browser') || 'missing'
    );

    // AC-05: Robots.txt crawler response
    const resRobots = await fetch(`${baseUrl}/robots.txt`);
    const robotsTxt = await resRobots.text();
    assert(
      robotsTxt.includes('Disallow: /studio/') &&
        robotsTxt.includes('Disallow: /api/') &&
        robotsTxt.includes('Disallow: /login') &&
        robotsTxt.includes('Disallow: /register') &&
        robotsTxt.includes('Allow: /'),
      'AC-05: Search crawler /robots.txt correctly disallows /studio/, /api/, /login, /register, and allows /',
      robotsTxt
    );

    // Dynamic Sitemap.xml
    const resSitemap = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await resSitemap.text();
    assert(
      sitemapXml.includes('<loc>https://raloa.app/</loc>') &&
        sitemapXml.includes('<loc>https://raloa.app/@elena</loc>') &&
        !sitemapXml.includes('<loc>https://raloa.app/studio</loc>'),
      'FR-3.3: Sitemap.xml includes landing pages & approved public profiles, excludes /studio',
      sitemapXml.slice(0, 200)
    );

    // FR-1.4 & FR-3.2: Public handle rewriting & OpenGraph hydration
    const resHandle = await fetch(`${baseUrl}/@elena`);
    const handleHtml = await resHandle.text();
    assert(
      handleHtml.includes('Elena (@elena)') && handleHtml.includes('og:title'),
      'FR-1.4 & FR-3.2: Public handle /@elena rewrites internally and hydrates OpenGraph metadata',
      handleHtml.slice(0, 300)
    );

    // AC-03: Invalid handle 404 response
    const resInvalidHandle = await fetch(`${baseUrl}/@nonexistent`);
    const invalidHtml = await resInvalidHandle.text();
    assert(
      invalidHtml.includes('@nonexistent'),
      'AC-03: Invalid handle /@nonexistent responds with handle context for Claim CTA',
      invalidHtml.slice(0, 200)
    );

    // AC-06: Custom domain with invalid/pending SSL -> 526 fallback screen
    const resPendingSsl = await fetch(`${baseUrl}/`, {
      headers: { 'x-forwarded-host': 'pending.custombrand.io' },
    });
    const pendingHtml = await resPendingSsl.text();
    assert(
      resPendingSsl.status === 526 &&
        pendingHtml.includes('526 Invalid SSL / Configuration Pending') &&
        pendingHtml.includes('pending.custombrand.io'),
      'AC-06: Custom domain with pending SSL returns 526 Invalid SSL screen with setup guide link',
      `Status: ${resPendingSsl.status}`
    );

    // Custom domain active mapping
    const resActiveDomain = await fetch(`${baseUrl}/`, {
      headers: { 'x-forwarded-host': 'portfolio.johndoe.com' },
    });
    const activeHtml = await resActiveDomain.text();
    assert(
      resActiveDomain.status === 200 && activeHtml.includes('Elena (@elena)'),
      'FR-1.3: Active custom domain maps host header to internal site_id target seamlessly',
      `Status: ${resActiveDomain.status}`
    );

  } finally {
    server.close();
  }

  console.log('\n--- Test Suite Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
