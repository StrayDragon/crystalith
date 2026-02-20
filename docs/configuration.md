# Configuration

Crystalith runtime configuration lives in `config/app.yaml`.

## Basics

- Keep secrets out of git. Prefer `.env` (Docker Compose) or `CRYSTALITH_SECRETS_PATH`.
- The config supports:
  - `${{ env.VAR }}` interpolation
  - `${{ secrets.VAR }}` interpolation
  - YAML anchors for reuse

## Common settings

- `app.cors.allow_origins`: browser client origins (CORS)
- `models.defaults.chat` / `models.defaults.embedding`: default model ids
- `vector_storage.provider`: `chroma` or `sqlite`
- `database.url`: SQLAlchemy URL (async)
- `embedding.batch_size`: embedding batch size (perf tuning)

## Secrets

`CRYSTALITH_SECRETS_PATH` can point to either:

- a YAML file (mapping of `KEY: value`), or
- a directory (Docker secrets style: one file per key)

See `docs/deployment.md` for examples.
