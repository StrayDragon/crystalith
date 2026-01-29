# Workspace E2E

This folder contains Playwright E2E tests for the workspace baseline.

## Prerequisites

- Start the frontend dev server:
  ```bash
  cd frontend/web
  pnpm dev
  ```

## Optional: Start full stack with isolated E2E DB

From repo root:

```bash
overmind s -f Procfile.e2e
```

This starts:
- backend on `http://127.0.0.1:8032` with a temporary sqlite DB (`data/e2e.db`)
- frontend on `http://127.0.0.1:3000`

Seed a notebook (optional, runs against the live backend):

```bash
cd backend/py
E2E_API_URL=http://127.0.0.1:8032 uv run scripts/e2e_seed.py
```

## Run live profile

Use the root script to start the full stack, seed data, and run live E2E:

```bash
./scripts/run-e2e.sh
```

Or run manually:

```bash
cd frontend/web
E2E_LIVE=1 pnpm test:e2e --project=live
```

Optional base URLs:

- `E2E_BASE_URL` overrides the default base URL.
- `E2E_LIVE_BASE_URL` overrides the live base URL only.
