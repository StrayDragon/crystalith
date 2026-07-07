# Repository Guidelines

## Project Structure & Module Organization
- `src/crystalith/` contains the FastAPI service code and core modules.
- `tests/` holds service-level tests; keep additions close to the code they cover.
- `packages/` stores workspace libraries; shared infra libraries use PyPI `lush-*` packages.
- `scripts/` includes maintenance helpers; `data/` is for local dev artifacts.

## Build, Test, and Development Commands
Run from `backend/py`:
- `uv sync` installs dependencies from `pyproject.toml` using uv.
- `just dev` starts the API server (uvicorn wrapper).
- `just test` runs the pytest suite.
- `just db-init` creates local SQLite tables for development.
- `just config-schema` regenerates `config/app.schema.gen.json`.
- `just packages-test` runs workspace package tests.
- `just llm-eval` runs the local eval harness.
- `just embedding-cache-bench` runs the Redis embedding cache benchmark.
- `just -l` lists available `just` tasks.

## Coding Style & Naming Conventions
- Python uses 4-space indentation; keep imports tidy and readable.
- Use `snake_case` for functions/variables and `PascalCase` for classes.
- Prefer high-coverage type hints (especially at module boundaries).
- Minimize `Any`; prefer `Protocol`/`TypedDict`/`Literal` and JSON-safe value types (`JsonValue`/`JsonDict`) for payloads.
- Avoid dynamic attribute access (`getattr`, `hasattr`, `__getattr__`); make interfaces explicit instead.
- No repo-wide formatter is enforced; match existing style and avoid large reformatting.
- If backend OpenAPI changed, run `cd frontend/web && pnpm run api:sync` and verify.

## Testing Guidelines
- Frameworks: `pytest` + `pytest-asyncio`.
- Test files follow `test_*.py`; package tests live under `packages/<name>/tests/`.
- Prefer targeted runs, e.g. `pytest tests/test_users.py`.

## Commit & Pull Request Guidelines
- Commit messages use type prefixes like `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`; optional scope: `feat(backend): ...`.
- PRs should include a focused description, linked issue/spec (if any), and test results. Add screenshots/GIFs for UI changes.

## Security & Configuration Tips
- Local config lives in `config/app.yaml`; schema in `config/app.schema.gen.json`.
- Never commit secrets or API keys. If config shape changes, document required keys.

## Agent-Specific Instructions
- For spec-driven or ambiguous changes, consult `llmanspec/config.yaml` for workflow and conventions before coding.
