import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  'http://127.0.0.1:8032';

function getPackageName(id: string): string | null {
  const parts = id.split('node_modules/');
  if (parts.length < 2) return null;

  const pkgPath = parts[parts.length - 1];
  const segments = pkgPath.split('/');
  if (segments.length === 0) return null;

  if (segments[0].startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }

  return segments[0];
}

function toSafeChunkName(name: string): string {
  return name
    .replace(/^@/, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-');
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
      '@crystalith-slidev': path.resolve(__dirname, '../packages/crystalith-slidev/src'),
    },
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
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/v1': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/health': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    exclude: [...configDefaults.exclude],
  },
});
