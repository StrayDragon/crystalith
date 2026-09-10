import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import { defineConfig } from '@rstest/core';

const includeExperimentalTests = process.env.RSTEST_INCLUDE_EXPERIMENTAL === '1';

export default defineConfig({
  // Reuse rsbuild.config.ts (alias/react/single react copy) for the test runtime.
  extends: withRsbuildConfig(),
  testEnvironment: 'jsdom',
  globals: true,
  setupFiles: ['./src/setupTests.ts'],
  exclude: [
    '**/node_modules/**',
    'vendor/**',
    ...(includeExperimentalTests ? [] : ['**/*.experimental.test.*']),
  ],
});
