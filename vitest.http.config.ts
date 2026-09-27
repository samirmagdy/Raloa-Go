import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from './tests/config.ts';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ['tests/http/**/*.test.ts'],
    isolate: false,
    sequence: { concurrent: false }
  }
});
