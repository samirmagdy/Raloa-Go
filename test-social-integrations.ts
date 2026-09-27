import app from './server';
import http from 'node:http';

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(3101, '127.0.0.1', resolve));
const baseUrl = 'http://127.0.0.1:3101';

try {
  const providers = await fetch(`${baseUrl}/api/integrations/providers`);
  const providerPayload = await providers.json() as { providers?: Array<{ provider: string; scopes: string[] }> };
  if (providers.status !== 200 || providerPayload.providers?.[0]?.provider !== 'github' || providerPayload.providers[0].scopes.join(',') !== 'read:user') {
    throw new Error('GitHub provider metadata or minimal scope is incorrect');
  }

  const unauthenticatedList = await fetch(`${baseUrl}/api/integrations`);
  if (unauthenticatedList.status !== 401) throw new Error('Integration list must require authentication');

  const unauthenticatedStart = await fetch(`${baseUrl}/api/integrations/github/start`, { redirect: 'manual' });
  if (unauthenticatedStart.status !== 401) throw new Error('OAuth start must require authentication');

  console.log('PASS: social integration provider metadata, scope minimization, and auth boundaries');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
