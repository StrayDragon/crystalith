# Workspace E2E

This folder contains Playwright E2E tests for the workspace baseline.

## Prerequisites

- Start the frontend dev server:
  ```bash
  cd frontend/web
  pnpm dev
  ```

## Run mock profile

Mock tests stub all `/v1/*` API calls with Playwright fixtures.

```bash
cd frontend/web
pnpm test:e2e --project=mock
```

## Run live profile

Live tests hit a real backend and use slow timeouts + `expect.poll`.

```bash
cd frontend/web
E2E_LIVE=1 pnpm test:e2e --project=live
```

Optional base URLs:

- `E2E_BASE_URL` overrides the default base URL (mock + live fallback).
- `E2E_LIVE_BASE_URL` overrides the live base URL only.

## Run both profiles

```bash
cd frontend/web
E2E_LIVE=1 pnpm test:e2e
```
