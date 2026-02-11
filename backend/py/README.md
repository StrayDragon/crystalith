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

Note: DB paths are resolved relative to the current working directory. When you
start the backend via the repo-root `Procfile` (`overmind s`), the default
`sqlite+aiosqlite:///./data/app.db` points to `./data/app.db` under the repo
root. Running `cd backend/py && just db-init` initializes
`backend/py/data/app.db` instead.

To initialize the same DB used by `overmind s`:

```bash
cd <repo-root>
uv run --project backend/py python backend/py/scripts/db_init.py
```

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
