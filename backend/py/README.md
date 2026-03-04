## Database schema

Crystalith uses SQLAlchemy (async) and supports SQLite (dev) and PostgreSQL (prod).

## Module layout

Backend source lives in `backend/py/src/crystalith`:

- `web/`: FastAPI app creation, global dependencies, router registration
- `features/`: business-domain slices (api/service/repo/schemas)
- `shared/`: cross-cutting infrastructure (config/db/ai/vector_storage/utils)

Dependency direction is enforced as `web -> features -> shared` via `just check-imports`.

### Database migrations (Alembic)

```bash
cd backend/py
just db-init
```

This runs `alembic upgrade head` (and will auto-stamp legacy databases that
were created before Alembic was introduced).

Note: SQLite / embedded Chroma paths are anchored to the config root (the
directory above `config/app.yaml`). By default, data lives under `<repo>/data`
regardless of where you run `just db-init` / `just dev` from.

Migration note: if you previously created `backend/py/data/*`, move it to
`<repo>/data/*` (e.g. `app.db`, `chroma/`, `vectors.db`).

You can override config discovery when running `db-init`:

```bash
CRYSTALITH_CONFIG_PATH=/app/config/app.yaml just db-init
# or
CRYSTALITH_CONFIG_DIR=/app/config just db-init
```

Optional flags:

```bash
uv run scripts/db_init.py --config-path /app/config/app.yaml --schema-path /app/config/app.schema.json
```

Create a new migration (autogenerate):

```bash
cd backend/py
just db-migrate "add new field"
```

Rollback the last migration:

```bash
cd backend/py
just db-rollback
```

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
