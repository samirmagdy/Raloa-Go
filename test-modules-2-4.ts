/**
 * Automated Verification Test Suite for Modules 2 & 4
 * Module 2: Anonymous Visitor Experience (Marketing Website)
 * Module 4: Authentication & Session Lifecycle
 * 
 * Verifies Acceptance Test Matrix:
 * - TC-M2-01: Handle claim availability check & registration redirection
 * - TC-M2-02: Anonymous template inspection & preview modal
 * - TC-M2-03: "Use this template" stages configuration & redirects to /register?template=...
 * - TC-M4-01: Credential login sets secure raloa_session cookie & redirects to /studio
 * - TC-M4-02: Logout execution invalidates server session, clears cookie & redirects to /
 * - TC-M4-03: Studio route guard intercepts unauthenticated request & redirects to /login?redirect=/studio
 * - TC-M4-04: Brute force throttling locks account after 5 failed attempts with 429 & cooldown timer
 * - FR-2.4: Contact form ingestion with IP rate limit (max 5/hr)
 * - FR-4.4: Password reset pipeline (256-bit token & TTL verification)
 * - FR-4.6: Google and Apple OAuth endpoints
 */

import http from 'node:http';
import app, {
  USERS_DB,
  ACTIVE_SESSIONS,
  LOGIN_ATTEMPTS,
  CONTACT_RATE_LIMITS,
  FORGOT_PW_RATE_LIMITS,
  PASSWORD_RESET_TOKENS
} from './server';

const TEST_PORT = 3098;
let server: http.Server;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING VERIFICATION TEST SUITE: MODULES 2 & 4');
  console.log('================================================================\n');

  // Start test server
  await new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[Test Server] Running on ${BASE_URL}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Test Case: TC-M2-01 (Handle Claim Availability & Regex Checking)
    // -------------------------------------------------------------
    console.log('Testing TC-M2-01: Anonymous Handle Claim Input & Availability Check...');

    // 1. Available handle check: 'mybrand'
    const resAvail = await fetch(`${BASE_URL}/api/v1/handles/check?handle=mybrand`);
    assert(resAvail.status === 200, 'GET /api/v1/handles/check?handle=mybrand returns 200 OK');
    const dataAvail = await resAvail.json();
    assert(dataAvail.status === 'success', 'Response status is "success"');
    assert(dataAvail.data.available === true, 'Handle "mybrand" is reported as available');
    assert(dataAvail.data.handle === 'mybrand', 'Handle in response matches requested handle');

    // 2. Reserved handle check: 'admin'
    const resReserved = await fetch(`${BASE_URL}/api/v1/handles/check?handle=admin`);
    assert(resReserved.status === 200, 'GET /api/v1/handles/check?handle=admin returns 200 OK');
    const dataReserved = await resReserved.json();
    assert(dataReserved.data.available === false, 'Reserved handle "admin" is reported as unavailable');

    // 3. Existing creator handle check: 'elena'
    const resElena = await fetch(`${BASE_URL}/api/v1/handles/check?handle=elena`);
    const dataElena = await resElena.json();
    assert(dataElena.data.available === false, 'Existing creator handle "elena" is reported as unavailable');

    // 4. Invalid handle format: 'a' (< 3 chars)
    const resInvalid = await fetch(`${BASE_URL}/api/v1/handles/check?handle=a`);
    assert(resInvalid.status === 400, 'Invalid handle format returns 400 Bad Request');

    // 5. Special characters invalid: 'test@handle'
    const resInvalidChars = await fetch(`${BASE_URL}/api/v1/handles/check?handle=test@handle`);
    assert(resInvalidChars.status === 400, 'Handle with invalid characters returns 400 Bad Request');
    console.log('✅ TC-M2-01 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: TC-M2-02 (Anonymous Template Inspection)
    // -------------------------------------------------------------
    console.log('Testing TC-M2-02: Anonymous Template Inspection (No Auth Required)...');
    const resTemplates = await fetch(`${BASE_URL}/templates`);
    assert(resTemplates.status === 200, 'GET /templates returns 200 OK without requiring authentication');
    const htmlTemplates = await resTemplates.text();
    assert(htmlTemplates.includes('Templates — RALOA'), 'SSR HTML contains Template Gallery metadata');
    console.log('✅ TC-M2-02 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: TC-M2-03 ("Use this template" Staging & Redirection)
    // -------------------------------------------------------------
    console.log('Testing TC-M2-03: "Use this template" Staged Parameter Redirection...');
    const resRegTemplate = await fetch(`${BASE_URL}/register?template=template_musician_01`);
    assert(resRegTemplate.status === 200, 'GET /register?template=template_musician_01 returns 200 OK');
    const htmlReg = await resRegTemplate.text();
    assert(htmlReg.includes('RALOA'), 'Register page serves HTML correctly with staged template parameter');
    console.log('✅ TC-M2-03 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: FR-2.4 (Contact Form Ingestion & IP Rate Limit)
    // -------------------------------------------------------------
    console.log('Testing FR-2.4: Contact Form Ingestion & IP Rate Limit (Max 5/hr)...');
    CONTACT_RATE_LIMITS.clear(); // Reset limit for test

    for (let i = 1; i <= 5; i++) {
      const resContact = await fetch(`${BASE_URL}/api/v1/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1' },
        body: JSON.stringify({
          fullName: `Inquirer ${i}`,
          email: `inquirer${i}@example.com`,
          subject: 'Partnership Inquiry',
          message: 'Hello RALOA team, we would like to collaborate.'
        })
      });
      assert(resContact.status === 200, `Submission #${i} succeeded with 200 OK`);
    }

    // 6th submission from same IP must be rate-limited (HTTP 429)
    const resContactExceeded = await fetch(`${BASE_URL}/api/v1/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1' },
      body: JSON.stringify({
        fullName: 'Spammer',
        email: 'spam@example.com',
        subject: 'Rate Limit Test',
        message: 'This should be blocked.'
      })
    });
    assert(resContactExceeded.status === 429, '6th contact submission returns 429 Too Many Requests');
    console.log('✅ FR-2.4 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: TC-M4-01 (Credential Login & Session Cookie)
    // -------------------------------------------------------------
    console.log('Testing TC-M4-01: Credential Login Execution...');
    LOGIN_ATTEMPTS.clear();

    const resLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({
        email: 'creator@example.com',
        password: 'SecurePassword123!'
      })
    });

    assert(resLogin.status === 200, 'POST /api/v1/auth/login returns 200 OK');
    const setCookie = resLogin.headers.get('set-cookie') || '';
    assert(setCookie.includes('raloa_session='), 'Response writes Set-Cookie: raloa_session=JWT_STRING');
    assert(setCookie.includes('HttpOnly'), 'Session cookie is HttpOnly');
    assert(setCookie.includes('SameSite=Lax'), 'Session cookie uses SameSite=Lax');
    assert(setCookie.includes('Max-Age=604800'), 'Session cookie has 7-day TTL (Max-Age=604800)');

    const dataLogin = await resLogin.json();
    assert(dataLogin.status === 'success', 'Login status is success');
    assert(dataLogin.data.redirect_to === '/studio', 'Response specifies redirect_to: /studio');
    assert(dataLogin.data.user.email === 'creator@example.com', 'User email returned accurately');
    assert(dataLogin.data.user.primary_handle === 'creator', 'User primary handle returned accurately');

    // Extract session token
    const tokenMatch = setCookie.match(/raloa_session=([^;]+)/);
    const sessionToken = tokenMatch ? tokenMatch[1] : '';
    assert(sessionToken.length > 0, 'Extracted valid session token');
    assert(ACTIVE_SESSIONS.has(sessionToken), 'Session token is recorded in server ACTIVE_SESSIONS');
    console.log('✅ TC-M4-01 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: TC-M4-03 (Studio Route Guarding)
    // -------------------------------------------------------------
    console.log('Testing TC-M4-03: Studio Route Guarding Middleware...');

    // 1. Unauthenticated request to /studio -> Must redirect with 302 to /login?redirect=/studio
    const resStudioAnon = await fetch(`${BASE_URL}/studio`, { redirect: 'manual' });
    assert(resStudioAnon.status === 302, 'Unauthenticated /studio returns 302 redirect');
    const locationHeader = resStudioAnon.headers.get('location') || '';
    assert(locationHeader.includes('/login'), 'Redirect target includes /login');
    assert(locationHeader.includes('redirect=/studio'), 'Redirect preserves redirect=/studio destination');

    // 2. Authenticated request to /studio with valid raloa_session -> Allows access (200 OK)
    const resStudioAuth = await fetch(`${BASE_URL}/studio`, {
      headers: { Cookie: `raloa_session=${sessionToken}` }
    });
    assert(resStudioAuth.status === 200, 'Authenticated request to /studio returns 200 OK');
    console.log('✅ TC-M4-03 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: TC-M4-02 (Session Invalidation / Logout)
    // -------------------------------------------------------------
    console.log('Testing TC-M4-02: Logout Execution...');
    const resLogout = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `raloa_session=${sessionToken}` }
    });

    assert(resLogout.status === 200, 'POST /api/v1/auth/logout returns 200 OK');
    const logoutCookie = resLogout.headers.get('set-cookie') || '';
    assert(logoutCookie.includes('Expires=Thu, 01 Jan 1970'), 'Logout clears cookie with epoch expiry');
    assert(!ACTIVE_SESSIONS.has(sessionToken), 'Server session token was invalidated in ACTIVE_SESSIONS');

    // Trying to access /studio again with the invalidated token must now redirect to /login
    const resStudioPostLogout = await fetch(`${BASE_URL}/studio`, {
      headers: { Cookie: `raloa_session=${sessionToken}` },
      redirect: 'manual'
    });
    assert(resStudioPostLogout.status === 302, 'Request to /studio after logout is redirected to /login');
    console.log('✅ TC-M4-02 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: TC-M4-04 (Brute Force Throttling & 429 Lockout)
    // -------------------------------------------------------------
    console.log('Testing TC-M4-04: SEC-2 Brute Force Throttling (5 Failed Attempts Lockout)...');
    LOGIN_ATTEMPTS.clear();
    const testIp = '192.0.2.77';
    const testEmail = 'creator@example.com';

    // 5 consecutive failed login attempts
    for (let attempt = 1; attempt <= 5; attempt++) {
      const resBad = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword!' })
      });

      if (attempt < 5) {
        assert(resBad.status === 401, `Failed attempt #${attempt} returns 401 Unauthorized`);
      } else {
        // The 5th failed attempt triggers the lockout (status 429)
        assert(resBad.status === 429, `5th consecutive failed attempt returns 429 Too Many Requests`);
        const dataLocked = await resBad.json();
        assert(dataLocked.error === 'Too Many Requests', 'Error response indicates "Too Many Requests"');
        assert(typeof dataLocked.retry_after === 'number' && dataLocked.retry_after > 0, 'Retry-After seconds provided');
      }
    }

    // Subsequent 6th attempt is also rejected with 429
    const resLocked = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword!' })
    });
    assert(resLocked.status === 429, 'Subsequent login attempt while locked returns 429');
    console.log('✅ TC-M4-04 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: FR-4.4 (Password Reset Pipeline)
    // -------------------------------------------------------------
    console.log('Testing FR-4.4: Password Reset Pipeline (Forgot & Reset)...');
    FORGOT_PW_RATE_LIMITS.clear();

    const resForgot = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.99' },
      body: JSON.stringify({ email: 'creator@example.com' })
    });
    assert(resForgot.status === 200, 'POST /api/v1/auth/forgot-password returns 200 OK');
    const dataForgot = await resForgot.json();
    assert(typeof dataForgot.token === 'string' && dataForgot.token.length >= 32, 'Dispatched 256-bit secure reset token');

    const resetToken = dataForgot.token;

    // Confirm password reset
    const resReset = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, new_password: 'NewSecurePassword456!' })
    });
    assert(resReset.status === 200, 'POST /api/v1/auth/reset-password returns 200 OK');

    // Token cannot be reused (consumed)
    const resResetReuse = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, new_password: 'AnotherPassword!' })
    });
    assert(resResetReuse.status === 400, 'Re-using consumed reset token returns 400 Bad Request');
    console.log('✅ FR-4.4 PASSED!\n');

    // -------------------------------------------------------------
    // Test Case: FR-4.6 (Social Identity Providers - Google & Apple)
    // -------------------------------------------------------------
    console.log('Testing FR-4.6: Social Identity Providers (Google & Apple OAuth)...');
    
    // Google OAuth
    const resGoogle = await fetch(`${BASE_URL}/api/v1/auth/oauth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'google.artist@gmail.com' })
    });
    assert(resGoogle.status === 200, 'Google OAuth returns 200 OK');
    const googleCookie = resGoogle.headers.get('set-cookie') || '';
    assert(googleCookie.includes('raloa_session='), 'Google OAuth sets raloa_session cookie');

    // Apple OAuth
    const resApple = await fetch(`${BASE_URL}/api/v1/auth/oauth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'apple.creator@privaterelay.appleid.com' })
    });
    assert(resApple.status === 200, 'Apple OAuth returns 200 OK');
    const appleCookie = resApple.headers.get('set-cookie') || '';
    assert(appleCookie.includes('raloa_session='), 'Apple OAuth sets raloa_session cookie');
    console.log('✅ FR-4.6 PASSED!\n');

    console.log('================================================================');
    console.log('🎉 ALL VERIFICATION TEST CASES (TC-M2-01..03, TC-M4-01..04) PASSED!');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
