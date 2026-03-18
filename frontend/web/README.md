# Crystalith Web

This frontend is built with Vite, React, and TypeScript.

## Available Scripts

In the project directory, you can run:

### `pnpm dev`

Runs the app in development mode.

### `pnpm test`

Runs the Vitest test runner.

### `pnpm run test:ci`

Runs the deterministic frontend quality gate (mock-report + stable test suite).

Notes:
- Test files named `*.experimental.test.ts(x)` are excluded by default and only run via `pnpm run test:all`.
- Stable tests default to `MSW onUnhandledRequest=error` to prevent accidental real network calls.
- `pnpm run test:all` defaults to `MSW onUnhandledRequest=warn` to reduce surprise while keeping visibility.

### `pnpm run test:core`

Runs a minimal UI core regression suite aligned with backend core API smoke paths (notebooks/analysis/sources/chat/outputs/health).
SSOT manifest: `openspec/specs/quality-and-regression/core_suite.json`.

### `pnpm run build`

Builds the app for production to the `dist` folder.

### `pnpm preview`

Serves the production build locally for verification.
