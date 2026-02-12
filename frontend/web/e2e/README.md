# Workspace E2E

This folder contains Playwright E2E tests for the workspace baseline.

## Prerequisites

- Start the backend dev server: `cd backend/py && just dev`
- Start the frontend dev server: `cd frontend/web && pnpm dev`

## Run E2E tests

```bash
cd frontend/web
pnpm test:e2e          # Run all E2E tests
pnpm test:e2e:ui       # Run with Playwright UI (interactive mode)
```

For live profile tests:

```bash
cd frontend/web
E2E_LIVE=1 pnpm test:e2e --project=live
```

Optional base URLs:

- `E2E_BASE_URL` overrides the default base URL.
- `E2E_LIVE_BASE_URL` overrides the live base URL only.
