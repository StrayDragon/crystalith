## Database schema

Crystalith uses SQLAlchemy (async) and supports SQLite (dev) and PostgreSQL (prod).

### Option A: create_all (MVP / local dev)

```bash
cd backend/py
uv run python -c "import asyncio; from crystalith.config import Settings; from crystalith.db import create_all, create_db_manager; s=Settings(); m=create_db_manager(s.database.url); asyncio.run(create_all(m.async_engine))"
```

This creates the `notebooks`, `sources`, and `chunks` tables.

### Option B: migrations (recommended for production)

This repo does not yet include a migration tool (e.g. Alembic). If you add migrations, wire them to the same metadata used by `crystalith.db` models.
