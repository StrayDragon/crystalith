# Optimal Configuration

## TL;DR

```bash
just up              # hybrid (default) — recommended for development
just up local        # no Docker at all
just up docker       # Docker deploy + optional external services
just up full         # everything in Docker
```

## Profile comparison

| | local | hybrid | docker | full |
|---|---|---|---|---|
| Hot reload | instant | instant | rebuild needed | rebuild needed |
| Docker required | no | deps only | yes | yes |
| Startup speed | fast | fast | slow (build) | slow (build) |
| Prod parity | low | medium | high | high |
| Best for | quick edits, offline | daily dev (recommended) | staging / integration | demo / production |

## Profile details

### local — Pure local dev

No Docker. Backend uses SQLite + embedded Chroma + in-memory cache.

```bash
just up local
```

Pros: zero dependencies beyond Python/Node, instant startup.
Cons: no Postgres, no Redis, no web search.

To add web search, run SearXNG yourself and set `search.searxng.host` in `config/app.yaml`.

### hybrid — Docker deps + local app (recommended)

Docker runs Postgres, ChromaDB, Redis, SearXNG. Backend + frontend run on host with hot reload.

```bash
just up              # or: just up hybrid
```

Customize deps in `.env`:

```bash
HYBRID_SERVICES=storage redis searxng          # default
HYBRID_SERVICES=storage redis searxng ollama   # add local LLM
HYBRID_SERVICES=storage redis                  # no web search
```

### docker — Docker deploy + external services

App runs in Docker. Choose which deps to include; the rest connect to external services via endpoint probing.

```bash
just up docker
```

Customize in `.env`:

```bash
DOCKER_SERVICES=storage redis searxng    # default: all deps in Docker
DOCKER_SERVICES=redis                    # only Redis in Docker; DB/Chroma/SearXNG external
DOCKER_SERVICES=                         # no deps; everything connects externally
```

External services are found automatically via `endpoint_candidates` in `config/app.yaml`, or override in `config/app.local.yaml`.

### full — Full Docker deployment

Everything in Docker, including Ollama and Slidev.

```bash
just up full
```

Customize in `.env`:

```bash
FULL_SERVICES=storage redis searxng ollama slidev    # default
```

## Smart endpoint resolution

All profiles share the same `config/app.yaml`. The backend automatically reorders endpoint candidates based on runtime context:

- **On host** (local/hybrid): `127.0.0.1:5434` is tried before `postgres:5432`
- **In Docker** (docker/full): `postgres:5432` is tried before `127.0.0.1:5434`

This means you never need to maintain separate config files for different environments.

## Recommended YAML knobs

In `config/app.yaml`:

| Setting | Key |
|---------|-----|
| Database | `database.url_candidates` |
| Vector store | `vector_storage.chroma.endpoint_candidates` |
| Cache | `cache.redis_url_candidates` |
| Search | `search.searxng.endpoint_candidates` |
| Ollama | `optional_services.ollama.endpoint_candidates` |
| Auto DB init | `app.startup.auto_db_init` |

In `.env`:

| Setting | Key |
|---------|-----|
| Profile | `CRYSTALITH_PROFILE` |
| Services | `HYBRID_SERVICES`, `DOCKER_SERVICES`, `FULL_SERVICES` |
| Web port | `CL_WEB_PORT` |
| Dev dep ports | `CL_DEPS_POSTGRES_PORT`, `CL_DEPS_CHROMA_PORT`, etc. |
| OpenAI override (Docker) | `OPENAI_BASE_URL_DOCKER` |
| Embedding model (Docker) | `CRYSTALITH_DEFAULT_EMBEDDING_MODEL_DOCKER` |

## Troubleshooting

- Dependency status: `GET /health/dependencies` or header button in UI
- Logs: `just logs` (follows the active profile)
- Status: `just status`
- Compose logs (advanced): `just dev-docker-logs` / `just dev-deps-logs`
