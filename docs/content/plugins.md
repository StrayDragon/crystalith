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

#### Optional extension attributes

The `OutputTypePlugin` Protocol intentionally remains minimal for backward compatibility.
At registration time, Crystalith uses `getattr()` to detect optional extension attributes:

- `metadata: OutputTypePluginMeta | None` — UI metadata (description, display_text, tone)
- `render_descriptor: RenderDescriptor | None` — declarative frontend layout descriptor
- `config_schema: PluginConfigSchema | None` — generation dialog configuration

These Pydantic models live in:

- `backend/py/src/crystalith/shared/plugins/render_types.py`

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
