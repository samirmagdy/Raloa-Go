import { afterEach, beforeEach, vi } from 'vitest';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TZ = 'UTC';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
