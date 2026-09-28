import { describe, expect, it, vi } from 'vitest';
import { createConfiguredDispatcher } from '../../server/background-jobs/dispatchers';

describe('configured background dispatcher', () => {
  it('does not construct or contact Cloud Tasks in Vitest even when cloud settings exist', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VITEST_WORKER_ID', '1');
    vi.stubEnv('CLOUD_TASKS_PROJECT_ID', 'test-project');
    vi.stubEnv('CLOUD_TASKS_LOCATION', 'europe-west1');
    vi.stubEnv('CLOUD_TASKS_QUEUE', 'raloa');
    vi.stubEnv('CLOUD_TASKS_WORKER_URL', 'https://worker.invalid/tasks');

    const dispatcher = createConfiguredDispatcher();

    await expect(dispatcher.dispatch({
      id: 'a'.repeat(64),
      kind: 'email_delivery',
      payload: {},
      idempotencyKey: 'test-dispatch',
      status: 'pending',
      attempts: 0,
      maxAttempts: 1,
      availableAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })).resolves.toBeUndefined();
  });
});
