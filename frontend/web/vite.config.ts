import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiProxyTarget =
  process.env.E2E_API_URL ||
  process.env.VITE_API_PROXY_TARGET ||
  'http://127.0.0.1:8032';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@crystalith-slidev': path.resolve(__dirname, '../packages/crystalith-slidev/src'),
    },
  },
  server: {
    port: 3000,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/v1': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
