import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from './tests/config.ts';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ['tests/unit/**/*.test.ts'],
    coverage: { ...sharedTestConfig.coverage, include: ['server/domains/orders/state-machine.ts'] }
  }
});
