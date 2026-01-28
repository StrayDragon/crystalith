## Database schema

Crystalith uses SQLAlchemy (async) and supports SQLite (dev) and PostgreSQL (prod).

## Module layout

Backend source lives in `backend/py/src/crystalith`:

- `web/`: FastAPI app creation, global dependencies, router registration
- `features/`: business-domain slices (api/service/repo/schemas)
- `shared/`: cross-cutting infrastructure (config/db/ai/vector_storage/utils)

Dependency direction is enforced as `web -> features -> shared` via `just check-imports`.

### Option A: create_all (MVP / local dev)

```bash
cd backend/py
just db-init
```

This creates the `notebooks`, `sources`, and `chunks` tables.

You can override config discovery when running `db-init`:

```bash
CRYSTALITH_CONFIG_PATH=/app/config/app.yaml just db-init
# or
CRYSTALITH_CONFIG_DIR=/app/config just db-init
```

Optional flags:

```bash
uv run scripts/db_init.py --config-path /app/config/app.yaml --schema-path /app/config/schema.json
```

### Option B: migrations (recommended for production)

This repo does not yet include a migration tool (e.g. Alembic). If you add migrations, wire them to the same metadata used by `crystalith.db` models.

## Vector storage migration (SQLite -> Chroma)

The legacy SQLite vector store can be migrated to embedded Chroma:

```bash
cd backend/py
just vector-migrate
```

Override data path resolution in Docker or custom environments:

```bash
CRYSTALITH_DATA_DIR=/data just vector-migrate
# or
uv run scripts/vector_migrate.py --data-dir /data
```
