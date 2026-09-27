import http from 'node:http';

process.env.NODE_ENV = 'production';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.K_SERVICE;
delete process.env.FIREBASE_ADMIN_ENABLED;

const { default: app } = await import('./server');
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(3113, '127.0.0.1', resolve));

try {
  const responses = await Promise.all([
    fetch('http://127.0.0.1:3113/api/media?siteId=site-one'),
    fetch('http://127.0.0.1:3113/api/media/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: 'site-one' }) }),
    fetch('http://127.0.0.1:3113/api/media/upload', { method: 'POST' })
  ]);
  if (!responses.every((response) => response.status === 401)) throw new Error(`media routes must require authentication: ${responses.map((response) => response.status).join(', ')}`);
  console.log('PASS: media routes require authentication');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
