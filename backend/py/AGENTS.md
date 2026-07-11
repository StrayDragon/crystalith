# backend/py — v1 Python Reference Implementation

> ⚠️ **v1 Python backend, preserved as a reference SSOT for the v2 TypeScript rewrite.**
> See root `AGENTS.md`, `apps/server/AGENTS.md`, and `PROGRESS.v2.md`.
>
> **Do NOT modify this codebase** during v2 development unless it's a critical bug fix that
> applies to both v1 and the v2 design. The live v2 server is **`apps/server/`**.

## Historically (v1)

This directory contained the Python backend for Crystalith:

- FastAPI + uvicorn HTTP server
- pydantic-ai + pydantic-graph for AI agent runtime
- SQLAlchemy[asyncio] + alembic for data layer
- ChromaDB for vector storage
- 21 feature modules, ~94 API endpoints

Earlier cleanup removed ~5,200 lines of glue (Rivu, Ollama, probe monitoring, etc.) while preserving business features.

## Build, Test, and Development (v1)

These commands still work if you need to run the v1 server for reference:

```bash
cd backend/py
uv sync                 # Install Python deps
just dev                # Run API server (uvicorn)
just test               # Run pytest suite
just db-init            # Initialize local SQLite
```

See `backend/py/README.md` for more details.
