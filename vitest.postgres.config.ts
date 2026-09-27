import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from './tests/config.ts';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
