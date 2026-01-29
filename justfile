default:
    @just -l


# Sync frontend API SDK with backend schema
api-sync: api-check
    cd frontend/web && pnpm run api:generate

# Check if API SDK is up to date
api-check:
    cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json

# Run all tests
test: test-backend test-frontend

# Run backend tests only
test-backend:
    cd backend/py && just test

# Run frontend tests only
test-frontend:
    cd frontend/web && pnpm test

# E2E helpers
e2e-up:
    overmind s -f Procfile.e2e

e2e-live:
    cd frontend/web && E2E_LIVE=1 pnpm test:e2e --project=live
