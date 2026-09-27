import http from 'node:http';

// Force the same unavailable-persistence condition a production process must
// handle. This test must not depend on local credentials or a Firestore record.
process.env.NODE_ENV = 'production';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.K_SERVICE;
delete process.env.FIREBASE_ADMIN_ENABLED;

const { default: app } = await import('./server');
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(3110, '127.0.0.1', resolve));

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

try {
  const apiResponse = await fetch('http://127.0.0.1:3110/api/public/sites/elena');
  const apiBody = await apiResponse.text();
  assert(apiResponse.status === 503, `public API should return 503 when persistence is unavailable, received ${apiResponse.status}`);
  assert(!apiBody.includes('"isPublished":true'), 'public API must never fabricate a published site');

  const profileResponse = await fetch('http://127.0.0.1:3110/@elena');
  const profileBody = await profileResponse.text();
  assert(profileResponse.status === 503, `SSR profile should return 503 when persistence is unavailable, received ${profileResponse.status}`);
  assert(!profileBody.includes('Elena (@elena)'), 'SSR must not render demo metadata without a persisted site');

  console.log('PASS: production public profile resolution never falls back to demo content');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
