import http from 'node:http';

process.env.NODE_ENV = 'production';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.K_SERVICE;
delete process.env.FIREBASE_ADMIN_ENABLED;

const { default: app } = await import('./server');
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(3111, '127.0.0.1', resolve));

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

try {
  const requests: Array<Promise<Response>> = [
    fetch('http://127.0.0.1:3111/api/creator/audience?type=subscribers'),
    fetch('http://127.0.0.1:3111/api/creator/audience/subscribers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com' }) }),
    fetch('http://127.0.0.1:3111/api/creator/audience/subscribers/record', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) }),
    fetch('http://127.0.0.1:3111/api/creator/audience/subscribers/record', { method: 'DELETE' }),
    fetch('http://127.0.0.1:3111/api/creator/audience/export?type=subscribers&format=csv')
  ];
  const responses = await Promise.all(requests);
  assert(responses.every((response) => response.status === 401), `all audience management routes must require authentication: ${responses.map((response) => response.status).join(', ')}`);
  console.log('PASS: audience management routes require authentication before reading or mutating records');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
