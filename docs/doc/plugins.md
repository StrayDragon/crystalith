# Plugins

Crystalith supports a backend plugin system (Python `entry_points`) for extending:

- AI providers (chat + embeddings)
- Document parsers (file ingestion)
- Output generation schemas (override existing output types)
- Web content extractors (URL fetch mode)
- Source connectors (external repositories / folders)

Plugins are discovered via Python `entry_points` at app startup.

## Official plugin suite

This repo ships a set of **official, optional capability plugins** under `backend/py/plugins/*`.

Install profiles:

- Core-only: `pip install crystalith` (minimal ingestion + minimal outputs; default docker image)
- Official full (recommended): `pip install 'crystalith[official-full]'`
- Smaller bundles: `official-connectors`, `official-outputs`, `official-parsers`, `official-extractors`

See also: [Official Plugins (Generated)](reference/plugins.gen.md)

Official plugin ids follow a stable naming convention:

- Output types: `output-<type>` (e.g. `output-quiz`)
- Parsers: `parser-<kind>` (e.g. `parser-pdf`)
- Web extractors: `extractor-<kind>` (e.g. `extractor-trafilatura`)
- Source connectors: `connector-<kind>` (e.g. `connector-obsidian`)

When capabilities are missing or skipped, the API exposes actionable hints:

- `GET /v1/workspace/tools` → `diagnostics.plugins` + `diagnostics.official`
- `GET /v1/notebooks/{notebook_id}/sources/extractors` → per-extractor `error_code` + `recovery_hint`
- `GET /v1/notebooks/{notebook_id}/source-connectors` → available connectors + connector diagnostics (installed + enabled only)

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

## 2) Enable / Disable / Order

Use `plugins.enabled` (allowlist) or `plugins.disabled` (denylist):

```yaml
plugins:
  enabled: ["output-faq", "parser-pdf", "extractor-trafilatura"]
  disabled: ["output-quiz"]
  # Optional deterministic order for conflict resolution.
  # Plugins listed here (and enabled) are loaded last, in the given order.
  # Under last-wins conflict resolution, later plugins win.
  load_order: ["output-faq"]
```

- If `plugins.enabled` is set, only those ids are loaded.
- `plugins.disabled` always skips matching ids.

## 3) Interfaces

All plugin interfaces live in `backend/py/src/crystalith/shared/plugins/interfaces.py`.

Plugins MUST declare `api_version` and it MUST be one of `SUPPORTED_PLUGIN_API_VERSIONS`
(currently `v1`). Incompatible plugins are skipped at startup with a structured reason.

## 3.1) Compliance checker

There is a lightweight compliance checker script:

```bash
cd backend/py
uv run python scripts/check_plugins.py --json
```

The JSON report includes:
- `host.plugin_api_version` + `host.supported_api_versions`
- `loaded`: loaded plugin ids
- `skipped`: plugin id → `{ error_code, message, hint?, details? }`
- `issues`: compliance issues for loaded plugins (human-readable strings)

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

#### Optional extension attributes

Output type plugins can optionally provide additional UI metadata:

- `metadata: OutputTypePluginMeta | None` — UI metadata (description, display_text, tone)
- `render_descriptor: RenderDescriptor | None` — declarative frontend layout descriptor
- `config_schema: PluginConfigSchema | None` — generation dialog configuration

These Pydantic models live in:

- `backend/py/src/crystalith/shared/plugins/render_types.py`

Notes:
- The Studio tool configuration dialog renders from `GET /v1/workspace/tools` only (using `config_schema`).
- `GET /v1/workspace/tools/{tool_id}/config` is kept for backwards compatibility and derived from the same schema.
- Default option selection uses `is_default=true` when present; otherwise the UI falls back to stable defaults.

If an extension attribute is present but has the wrong type, the registry logs a warning and ignores it.

If multiple plugins register the same `output_type`, the last one wins and the registry logs a warning.

#### Example (OutputTypePlugin)

```py
from pydantic import BaseModel, Field

from crystalith.shared.plugins.render_types import (
    ConfigOption,
    FieldDescriptor,
    ItemSchema,
    OutputTypePluginMeta,
    PluginConfigSchema,
    RenderDescriptor,
)


class MyItem(BaseModel):
    text: str
    citations: list[int] = Field(default_factory=list)


class MyOutput(BaseModel):
    items: list[MyItem] = Field(default_factory=list)


class MyPlugin:
    api_version = "v1"

    output_type = "FAQ"
    schema = MyOutput
    default_prompt = "Generate a FAQ from the sources."

    metadata = OutputTypePluginMeta(
        description="问答清单",
        display_text="闪卡",
        tone="blue",
    )

    render_descriptor = RenderDescriptor(
        layout="list",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="text", type="text", label="Text"),
                FieldDescriptor(key="citations", type="citation", label=None),
            ]
        ),
        options={"items_key": "items"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[ConfigOption(id="standard", label="Standard", is_default=True)],
        difficulty_options=[],
        topic_placeholder="Topic (optional)",
        supports_topic=True,
    )


plugin = MyPlugin()
```

### WebExtractorPlugin

Implement a factory with:

- `extractor_type: str` (e.g. `"trafilatura"`)
- `display_name: str | None` / `description: str | None` (optional UI metadata)
- `requires_api_key: bool` / `requires_service: bool` (UI hints)
- `create_extractor(settings, url_fetch_security=...) -> Extractor`

Notes:
- The host `ExtractorFactory` owns fallback/retry semantics and SSRF redirect revalidation.
- Notebook-level enablement is controlled by `PATCH /v1/notebooks/{notebook_id}/sources/extractors` (`mode=inherit_global|custom`).

### SourceConnectorPlugin

Source connectors are backend plugins that let the host enumerate and import files from external repositories
(e.g. an Obsidian vault or a local directory).

In v1, connector plugins are **backend-only**:
- the host owns persistence (notebook-scoped bindings) and the workflow UI
- connectors provide config schema, diagnostics, snapshot enumeration, and file reads

Implement a factory with:

- `display_name: str` / `description: str | None`
- `connection_config_schema: dict` (JSON Schema)
- capabilities: `supports_snapshot: bool`, `supports_sync_check: bool`
- `get_diagnostics(settings, connection_config=...) -> list[dict] | None`
- `list_snapshot_entries(settings, connection_config=...) -> list[dict]`
- `read_file_bytes(settings, connection_config=..., relative_path=...) -> bytes`

API surfaces (host-owned):
- `GET /v1/notebooks/{notebook_id}/source-connectors`
- `POST /v1/notebooks/{notebook_id}/source-connectors/{connector_id}/bindings`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/snapshot`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/import-scope`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check`
- `POST /v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check/apply`

## 4) Example plugin

See `backend/py/examples/crystalith-echo-plugin/`.

Install it (editable) and start the backend:

```bash
cd backend/py
pip install -e examples/crystalith-echo-plugin
just dev
```

Then add a model using `provider: "echo"` and restart.

For OutputTypePlugin examples, see:

- `backend/py/examples/crystalith-output-quiz/`
- `backend/py/examples/crystalith-output-timeline/`
- `backend/py/examples/crystalith-output-mindmap/`

## 5) Copier template

See `backend/py/tools/copier-crystalith-plugin/`:

```bash
copier copy backend/py/tools/copier-crystalith-plugin path/to/destination
```

The template will prompt for package name, module name, plugin id, etc. Answers are recorded in `.copier-answers.yml` so you can later update with:

```bash
copier update path/to/destination
```
