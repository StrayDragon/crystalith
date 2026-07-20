import path from 'path';

import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

/** Force a single React copy for Vitest (MT / emotion / RTL must share one dispatcher). */
const reactRoot = path.resolve(__dirname, 'node_modules/react');
const reactDomRoot = path.resolve(__dirname, 'node_modules/react-dom');

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8032';
const slidevProxyTarget = process.env.VITE_SLIDEV_PROXY_TARGET || 'http://127.0.0.1:3030';
const includeExperimentalTests = process.env.VITEST_INCLUDE_EXPERIMENTAL === '1';

function getPackageName(id: string): string | null {
  const parts = id.split('node_modules/');
  if (parts.length < 2) return null;

  const pkgPath = parts.at(-1);
  const segments = pkgPath.split('/');
  if (segments.length === 0) return null;

  if (segments[0].startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }

  return segments[0];
}

function toSafeChunkName(name: string): string {
  return name
    .replace(/^@/u, '')
    .replaceAll(/[\\/]/gu, '-')
    .replaceAll(/[^a-zA-Z0-9_-]/gu, '-');
}

function manualChunks(id: string): string | undefined {
  const pkgName = getPackageName(id);
  if (!pkgName) return undefined;

  if (pkgName === 'jspdf') {
    return 'vendor-export-jspdf';
  }

  if (pkgName === 'pptxgenjs') {
    return 'vendor-export-pptxgenjs';
  }

  if (
    pkgName.startsWith('@emotion/') ||
    pkgName.startsWith('emotion-') ||
    pkgName === 'hoist-non-react-statics'
  ) {
    return 'vendor-mui';
  }

  if (
    pkgName === 'react' ||
    pkgName === 'react-dom' ||
    pkgName === 'scheduler' ||
    pkgName === 'use-sync-external-store'
  ) {
    return 'vendor-react';
  }

  if (pkgName.startsWith('@mui/')) {
    return 'vendor-mui';
  }

  if (
    pkgName === 'framer-motion' ||
    pkgName === 'popmotion' ||
    pkgName === 'framesync' ||
    pkgName === 'style-value-types' ||
    pkgName === 'hey-listen' ||
    pkgName.startsWith('@motionone/') ||
    pkgName.startsWith('motionone-')
  ) {
    return 'vendor-framer-motion';
  }

  if (pkgName === '@material-tailwind/react') {
    return 'vendor-material-tailwind';
  }

  if (pkgName.startsWith('@floating-ui/')) {
    return 'vendor-material-tailwind';
  }

  if (pkgName.startsWith('@xyflow/') || pkgName.startsWith('d3-')) {
    return 'vendor-xyflow';
  }

  if (pkgName === 'gridstack') {
    return 'vendor-gridstack';
  }

  if (pkgName === 'react-virtuoso') {
    return 'vendor-virtuoso';
  }

  if (pkgName === 'swr' || pkgName === 'zustand') {
    return 'vendor-state';
  }

  if (pkgName.startsWith('@hey-api/')) {
    return 'vendor-openapi';
  }

  return `vendor-${toSafeChunkName(pkgName)}`;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@crystalith/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@crystalith-slidev': path.resolve(__dirname, '../../packages/crystalith-slidev/src'),
      react: reactRoot,
      'react-dom': reactDomRoot,
      'react/jsx-runtime': path.join(reactRoot, 'jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(reactRoot, 'jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port: 3000,
    // Match Slidev: avoid [::1]-only bind so 127.0.0.1:3000 also works.
    host: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/v1': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/v2': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/openapi.json': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/asyncapi.json': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/health': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      // Studio iframe uses same-origin /slidev → Slidev CLI (:3030, --base /slidev/)
      '/slidev': {
        target: slidevProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      'vendor/**',
      ...(includeExperimentalTests ? [] : ['**/*.experimental.test.*']),
    ],
  },
});
