default:
    @just -l

SDK_PATH := "sdk/client/python"


# Sync frontend API SDK with backend schema
api-sync: api-check
    cd frontend/web && pnpm run api:generate

# Check if API SDK is up to date
api-check:
    cd backend/py && uv run scripts/api_schema.py check -s ../../frontend/web/openapi.json

# Generate Python SDK (manual, Fern)
sdk-gen VERSION='':
    cd backend/py && uv run scripts/api_schema.py export -o ../../frontend/web/openapi.json
    SDK_VERSION={{VERSION}} SDK_PATH={{SDK_PATH}} ./scripts/sdk/generate_python_sdk.sh

# Check Python SDK is up to date (for pre-commit)
sdk-check:
    cd backend/py && uv run scripts/api_schema.py export -o ../../frontend/web/openapi.json
    SDK_PATH={{SDK_PATH}} ./scripts/sdk/generate_python_sdk.sh
    git add {{SDK_PATH}}
    git diff --staged --exit-code

# Run pre-commit checks
check-pre-commit-hooks:
    prek run --all-files

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
