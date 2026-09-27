import http from 'node:http';

process.env.NODE_ENV = 'staging';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.K_SERVICE;
delete process.env.FIREBASE_ADMIN_ENABLED;

const { default: app } = await import('./server');
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(3112, '127.0.0.1', resolve));

try {
  const responses = await Promise.all([
    fetch('http://127.0.0.1:3112/api/sites'),
    fetch('http://127.0.0.1:3112/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'site-one' }) }),
    fetch('http://127.0.0.1:3112/api/sites/site-one', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'site-one' }) }),
    fetch('http://127.0.0.1:3112/api/sites/site-one', { method: 'DELETE' })
  ]);
  if (!responses.every((response) => response.status === 401)) throw new Error(`site lifecycle routes must require authentication: ${responses.map((response) => response.status).join(', ')}`);
  console.log('PASS: multi-site lifecycle routes require authentication');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
