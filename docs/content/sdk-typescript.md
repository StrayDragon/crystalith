# TypeScript SDK

## Overview
The TypeScript SDK is generated from the backend OpenAPI schema and packaged for npm.

- npm package: `@crystalith/sdk`
- Repo package root: `sdk/client/typescript`
- Generated client source: `sdk/client/typescript/src/generated`

The Web UI still uses a generated client under `frontend/web/src/api/generated`.

## Versioning / Alignment
- SDK version matches `backend/py/pyproject.toml` and release tags (`vX.Y.Z`).
- Check alignment: `just sdk-version-check`.

## Install

```bash
npm install @crystalith/sdk
```

## Local generation (repo)

```bash
just api-export
just sdk-gen-typescript
just sdk-build-typescript

# Drift check (regenerate + git diff)
just sdk-check-typescript
```

## Minimal example

Base URL (no `/v1`):
- Local dev (`cd backend/py && just dev`): `http://127.0.0.1:8032`
- Docker Compose (same entrypoint as Web UI): `http://localhost:${CL_WEB_PORT:-8080}`

Note: Port `8000` is typically an optional dependency (e.g. Chroma), not the Crystalith API.
Auth (optional): if `app.auth.enabled=true`, send `Authorization: Bearer <token>` (or `X-API-Key: <token>`).

```ts
import {
  listNotebooksV1NotebooksGet as listNotebooks,
  client,
} from '@crystalith/sdk';

const apiKey = '<token>'; // optional

client.setConfig({
  baseUrl: 'http://127.0.0.1:8032',
  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  responseStyle: 'fields',
  throwOnError: true,
});

const res = await listNotebooks<true>();
console.log(res.data);
```
