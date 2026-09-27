export const sharedTestConfig = {
  setupFiles: ['./tests/setup.ts'],
  environment: 'node' as const,
  pool: 'forks' as const,
  isolate: true,
  clearMocks: true,
  restoreMocks: true,
  unstubGlobals: true,
  unstubEnvs: true,
  testTimeout: 10_000,
  hookTimeout: 10_000,
  reporters: process.env.CI ? ['default', 'junit'] : ['default'],
  outputFile: process.env.CI ? { junit: 'reports/vitest-junit.xml' } : undefined,
  coverage: {
    provider: 'v8' as const,
    reporter: ['text', 'html', 'lcov'],
    reportsDirectory: './reports/coverage',
    thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 }
  }
};
