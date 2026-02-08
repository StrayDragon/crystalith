# Plugins

Crystalith supports a small backend-only plugin system for extending:

- AI providers (chat + embeddings)
- Document parsers (file ingestion)
- Output generation schemas (override existing output types)

Plugins are discovered via Python `entry_points` at app startup.

## 1) Discovery

Plugins MUST be registered under the entry point group `crystalith.plugins`:

```toml
[project.entry-points."crystalith.plugins"]
my-provider = "my_pkg.plugin:plugin"
```

The **entry point name** (`my-provider`) is used as the provider id in config:

```yaml
models:
  available:
    - id: "my-chat-model"
      provider: "my-provider"
      model: "..."
      roles: [chat]
```

## 2) Enable / Disable

Use `plugins.enabled` (allowlist) or `plugins.disabled` (denylist):

```yaml
plugins:
  disabled: ["my-provider"]
```

If `plugins.enabled` is set, only those ids are loaded.

## 3) Interfaces

All plugin interfaces live in `backend/py/src/crystalith/shared/plugins/interfaces.py`.

## 3.1) Compliance checker

There is a lightweight compliance checker script:

```bash
cd backend/py
uv run python scripts/check_plugins.py --json
```

### AIProviderPlugin

Implement `create_chat_provider()` and `create_embedding_provider()` to return objects that satisfy:

- `crystalith.shared.ai.interfaces.ChatProvider`
- `crystalith.shared.ai.interfaces.EmbeddingProvider`

### ParserPlugin

Implement a factory with:

- `parser_type: str`
- `supported_mime_types: set[str]`
- `supported_extensions: set[str]`
- `create_parser(...) -> Parser`

### OutputTypePlugin

Output plugins currently **override existing** output types (by `OutputType.value`) because outputs are persisted with a DB enum.

- `output_type: str` (e.g. `"FAQ"`, `"GUIDE"`)
- `schema: type[pydantic.BaseModel]`
- `default_prompt: str | None`

## 4) Example plugin

See `backend/py/examples/crystalith-echo-plugin/`.

Install it (editable) and start the backend:

```bash
cd backend/py
pip install -e examples/crystalith-echo-plugin
just dev
```

Then add a model using `provider: "echo"` and restart.

## 5) Cookiecutter template

See `backend/py/tools/cookiecutter-crystalith-plugin/`:

```bash
cookiecutter backend/py/tools/cookiecutter-crystalith-plugin
```
