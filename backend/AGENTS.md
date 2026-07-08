# backend (v2 Transition)

> **v1 Python reference SSOT**: `backend/py/` is the Python v1 implementation (FastAPI + pydantic-ai + SQLAlchemy + ChromaDB).
> It is **preserved as-is** during v2 rewrite for behavior reference.
> Do NOT modify v1 code unless it's a critical fix that also applies to the v2 design.

## v2 Target

The Python backend is being rewritten in Bun + TypeScript:
- `server/` — Bun + Elysia + Drizzle ORM + Vercel AI SDK + sqlite-vec
- Same business features, different implementation

See root `AGENTS.md` and `llmanspec/changes/` for the full plan.

## v1 Reference

For v1 Python-specific development documentation, see `backend/py/AGENTS.md`.
