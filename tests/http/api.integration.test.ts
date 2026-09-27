import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../../server';

describe('HTTP API integration boundary', () => {
  it('returns the stable validation envelope for invalid public input', async () => {
    const response = await request(app).get('/api/v1/handles/check?handle=a');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ status: 'error' });
    expect(response.body.message).toMatch(/Invalid handle format/);
  });

  it('does not expose internal routes without their server credential', async () => {
    const response = await request(app).post('/internal/outbox/publish').send({ limit: 1 });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ errorCode: 'UNAUTHORIZED', error: { code: 'UNAUTHORIZED' } });
  });

  it('keeps private API paths off the public-web deployment role', async () => {
    vi.stubEnv('SERVICE_ROLE', 'public-web');
    const response = await request(app).get('/api/account/billing');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('standardizes authentication errors via centralized error handling', async () => {
    const response = await request(app).post('/api/billing/checkout-session').send({ plan: 'pro' });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'error',
      code: 'AUTHENTICATION_REQUIRED',
      errorCode: 'AUTHENTICATION_REQUIRED',
      error: {
        code: 'AUTHENTICATION_REQUIRED'
      }
    });
  });

  it('standardizes validation errors via centralized error handling', async () => {
    const response = await request(app).get('/api/v1/handles/check?handle=bad*handle');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'error'
    });
  });
});
