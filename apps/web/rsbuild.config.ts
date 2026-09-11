import path from 'path';

import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8032';
const slidevProxyTarget = process.env.VITE_SLIDEV_PROXY_TARGET || 'http://127.0.0.1:3030';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/app/main.tsx',
    },
    // import.meta.env.VITE_* — same semantics as Vite envDir/prefix behavior.
    define: loadEnv({ prefixes: ['VITE_'] }).publicVars,
  },
  html: {
    template: './index.html',
  },
  resolve: {
    alias: {
      '@brand': path.resolve(__dirname, '../../assets'),
      '@crystalith/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@crystalith-slidev': path.resolve(__dirname, '../../packages/crystalith-slidev/src'),
      // Force a single React copy (MT / emotion / RTL must share one dispatcher).
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.join(
        path.resolve(__dirname, 'node_modules/react'),
        'jsx-runtime.js',
      ),
      'react/jsx-dev-runtime': path.join(
        path.resolve(__dirname, 'node_modules/react'),
        'jsx-dev-runtime.js',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Rsbuild ≥2.0 top-level option; names/structure map to Rspack's
  // optimization.splitChunks (design.md §3 — Vite manualChunks rewrite).
  splitChunks: {
    preset: 'per-package',
    cacheGroups: {
      libReact: {
        test: /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/,
        name: 'vendor-react',
        priority: 20,
      },
      vendorMui: {
        test: /[\\/]node_modules[\\/](@emotion|@mui|emotion-|hoist-non-react-statics)[\\/]/,
        name: 'vendor-mui',
        priority: 20,
      },
      exportJspdf: {
        test: /[\\/]node_modules[\\/]jspdf[\\/]/,
        name: 'vendor-export-jspdf',
        priority: 20,
      },
      exportPptx: {
        test: /[\\/]node_modules[\\/]pptxgenjs[\\/]/,
        name: 'vendor-export-pptxgenjs',
        priority: 20,
      },
      framerMotion: {
        test: /[\\/]node_modules[\\/](framer-motion|popmotion|framesync|style-value-types|hey-listen|@motionone|motionone)[\\/]/,
        name: 'vendor-framer-motion',
        priority: 20,
      },
      materialTW: {
        test: /[\\/]node_modules[\\/](@material-tailwind|@floating-ui)[\\/]/,
        name: 'vendor-material-tailwind',
        priority: 20,
      },
      xyflow: {
        test: /[\\/]node_modules[\\/](@xyflow|d3-)[\\/]/,
        name: 'vendor-xyflow',
        priority: 20,
      },
      gridstack: {
        test: /[\\/]node_modules[\\/]gridstack[\\/]/,
        name: 'vendor-gridstack',
        priority: 20,
      },
      virtuoso: {
        test: /[\\/]node_modules[\\/]react-virtuoso[\\/]/,
        name: 'vendor-virtuoso',
        priority: 20,
      },
      stateLibs: {
        test: /[\\/]node_modules[\\/](swr|zustand)[\\/]/,
        name: 'vendor-state',
        priority: 20,
      },
    },
  },
  server: {
    port: 3000,
    // Match Slidev: avoid [::1]-only bind so 127.0.0.1:3000 also works.
    host: true,
    strictPort: true,
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
  tools: {
    rspack: (config, { rspack }) => {
      // B1: pptxgenjs 4.0.1 dynamically `import('node:fs'|'node:https')` in its
      // Node branch (isNode-guarded, never runs in the browser). Rspack treats
      // `node:` as an URI scheme — alias/fallback/aliasFields cannot intercept
      // it (research.md §3 B1) — so replace those requests with an empty module.
      // No upstream fix as of 4.0.1 (latest, 2025-06); drop this when fixed.
      config.plugins!.push(
        new rspack.NormalModuleReplacementPlugin(
          /^node:(fs|https)$/,
          path.resolve(__dirname, 'scripts/empty-module.js'),
        ),
      );
    },
  },
});
