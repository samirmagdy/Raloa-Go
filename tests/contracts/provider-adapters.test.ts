import { describe, expect, it, vi } from 'vitest';
import type { CloudflareProvider, EmailProvider, PaymentProvider } from '../../server/core/providers';
import { createCloudflareDomainAdapter } from '../../server/adapters/cloudflare-domains';
import { createFirebaseAuthAdapter } from '../../server/adapters/firebase-auth';
import { createFirebaseStore } from '../../server/adapters/firebase';
import { createCloudflareR2StorageAdapter, createFirebaseStorageAdapter } from '../../server/adapters/media-storage';
import { resendEmailAdapter } from '../../server/adapters/email';
import { createStripeAdapter, stripeAdapter } from '../../server/adapters/stripe';
import { createGoogleCalendarAdapter, createMicrosoftGraphCalendarAdapter } from '../../server/adapters/calendar';

function expectProviderContract(provider: PaymentProvider | EmailProvider | CloudflareProvider, methods: string[]) {
  for (const method of methods) expect(typeof (provider as unknown as Record<string, unknown>)[method]).toBe('function');
}

describe('Stripe adapter contract', () => {
  it('exposes normalized billing operations without requiring credentials in tests', () => {
    expectProviderContract(stripeAdapter, ['createCheckoutSession', 'createPortalSession', 'handleWebhook', 'isConfigured']);
    expect(stripeAdapter.isConfigured()).toBe(false);
  });

  it('delegates provider calls through an injectable seam', async () => {
    const adapter = createStripeAdapter({ isConfigured: () => true, createCheckoutSession: async () => ({ id: 'checkout-1' }), createPortalSession: async () => ({ url: 'https://billing.test' }), handleWebhook: async () => ({ received: true }) });
    await expect(adapter.createCheckoutSession()).resolves.toEqual({ id: 'checkout-1' });
    await expect(adapter.createPortalSession()).resolves.toEqual({ url: 'https://billing.test' });
    await expect(adapter.handleWebhook()).resolves.toEqual({ received: true });
  });
});

describe('Cloudflare adapter contract', () => {
  it('normalizes provision, verify, and remove responses', async () => {
    const calls: Array<{ path: string; options?: any }> = [];
    const adapter = createCloudflareDomainAdapter({
      zoneId: 'zone-1', origin: 'https://example.test',
      request: async (path, options) => {
        calls.push({ path, options });
        if (path.endsWith('custom_hostnames') && options?.method === 'POST') return { id: 'cf-1', dns_records: [{ type: 'CNAME', name: 'example.test', content: 'target.example.test', ttl: 120 }], ssl: { status: 'active' } };
        return { status: 'active', ssl: { status: 'active' } };
      }
    });
    await expect(adapter.provision({ hostname: 'example.test', siteId: 'site-1', idempotencyKey: 'idempotency-1' })).resolves.toMatchObject({ providerHostnameId: 'cf-1', certificateStatus: 'active', dnsInstructions: [{ value: 'target.example.test' }] });
    await expect(adapter.verify('cf-1')).resolves.toEqual({ verified: true, certificateStatus: 'active' });
    await expect(adapter.remove('cf-1')).resolves.toBeUndefined();
    expect(calls).toHaveLength(3);
  });
});

describe('Firebase and storage adapter contracts', () => {
  it('keeps Firestore persistence behind the adapter', async () => {
    const data = new Map<string, Record<string, unknown>>();
    const db = {
      collection: (collection: string) => ({
        doc: (id: string) => ({
          get: async () => ({ exists: data.has(`${collection}/${id}`), data: () => data.get(`${collection}/${id}`) }),
          set: async (value: Record<string, unknown>) => { data.set(`${collection}/${id}`, value); },
          delete: async () => { data.delete(`${collection}/${id}`); }
        }),
        where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
        limit: () => ({ get: async () => ({ docs: [] }) })
      })
    };
    const store = createFirebaseStore(db as never);
    await store.save('sites', 'site-1', { ownerId: 'user-1' });
    await expect(store.get('sites', 'site-1')).resolves.toEqual({ ownerId: 'user-1' });
    await store.remove('sites', 'site-1');
    await expect(store.get('sites', 'site-1')).resolves.toBeNull();
  });

  it('normalizes Firebase Storage and R2 results to the media contract', async () => {
    const client = { putObject: vi.fn(async () => ({ bytes: 12, checksum: 'sha256' })), deleteObject: vi.fn(async () => undefined), listObjects: vi.fn(async () => ['media/a']), publicUrl: (key: string) => `https://cdn.test/${key}` };
    const input = { objectKey: 'media/a', bytes: new Uint8Array([1]), contentType: 'image/png' };
    await expect(createFirebaseStorageAdapter(client).put(input)).resolves.toMatchObject({ provider: 'firebase_storage', bytes: 12, cdnUrl: 'https://cdn.test/media/a' });
    await expect(createCloudflareR2StorageAdapter(client).put(input)).resolves.toMatchObject({ provider: 'cloudflare_r2', objectKey: 'media/a' });
    expect(client.putObject).toHaveBeenCalledTimes(2);
  });
});

describe('Email and Firebase Auth adapter contracts', () => {
  it('sends the normalized email payload and never returns provider data', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resendEmailAdapter.send({ to: 'creator@example.test', subject: 'Hello', text: 'Message', idempotencyKey: 'notification:test-1' })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe('https://api.resend.com/emails');
    expect(request[1]?.headers).toMatchObject({ 'Idempotency-Key': 'notification:test-1' });
  });

  it('maps Firebase Auth verification success and failure to the application identity contract', async () => {
    const verifyIdToken = vi.fn().mockResolvedValueOnce({ uid: 'user-1', email: 'creator@example.test' }).mockRejectedValueOnce(new Error('provider failure'));
    const adapter = createFirebaseAuthAdapter({ verifyIdToken });
    await expect(adapter.verifyBearerToken('v'.repeat(32))).resolves.toEqual({ uid: 'user-1', email: 'creator@example.test' });
    await expect(adapter.verifyBearerToken('i'.repeat(32))).resolves.toBeNull();
  });
});

describe('Google Calendar and Microsoft Graph adapter contracts', () => {
  it('exposes provider-specific typed calendar adapters', () => {
    expect(createGoogleCalendarAdapter().provider).toBe('google');
    expect(createMicrosoftGraphCalendarAdapter().provider).toBe('outlook');
  });

  it.each([
    ['google', 'https://www.googleapis.com/calendar/v3/calendars/primary/events'],
    ['outlook', 'https://graph.microsoft.com/v1.0/me/events']
  ] as const)('normalizes %s token exchange and event creation', async (provider, eventUrl) => {
    vi.stubEnv('NODE_ENV', 'test');
    const prefix = provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
    vi.stubEnv(`${prefix}_CALENDAR_CLIENT_ID`, `${provider}-client`);
    vi.stubEnv(`${prefix}_CALENDAR_CLIENT_SECRET`, `${provider}-secret`);
    vi.stubEnv(`${prefix}_CALENDAR_REDIRECT_URI`, `https://app.test/${provider}/callback`);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: `${provider}-access`, refresh_token: `${provider}-refresh`, expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: `${provider}-event` }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { calendarAdapter } = await import('../../server-calendar');
    const adapter = calendarAdapter(provider);
    const tokens = await adapter.exchangeCode('authorization-code');
    await expect(adapter.createEvent(tokens, { id: 'booking-1', title: 'Booking', start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z', timezone: 'UTC', attendeeEmail: 'guest@example.test' })).resolves.toEqual({ externalEventId: `${provider}-event` });
    expect(fetchMock).toHaveBeenNthCalledWith(2, eventUrl, expect.objectContaining({ method: 'POST' }));
  });
});
