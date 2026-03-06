# crystalith-slides-slidev

Official Crystalith `SlidesWorkflowPlugin` reference implementation for `SLIDES`, backed by Slidev.

## What this plugin demonstrates

This package is intentionally kept as a **complex reference plugin** rather than a minimal sample.
It shows how to package a non-trivial workflow plugin that owns:

- rich `config_schema` defaults and options
- multi-stage slides generation (`outline` + `markdown`)
- preview metadata for the active slides engine
- frontend bundle metadata for custom rendering
- theme preset templates and frontmatter composition

Core still owns draft CRUD, SSE streaming, output sync, and preview markdown persistence. The plugin
owns engine-specific generation behavior and the contract exposed to `/v1/workspace/tools`.

## Stable ids

- Python package: `crystalith-slides-slidev`
- Plugin id / entry point name: `slides-slidev`
- Engine: `slidev`

## Install

Recommended self-host install:

```bash
cd backend/py
uv sync --extra official-slides
```

Local package install during plugin development:

```bash
cd backend/py
uv pip install ./plugins/crystalith-slides-slidev
```

## Enable and select

Add the plugin to `config/app.yaml`:

```yaml
plugins:
  enabled:
    - slides-slidev

slides:
  default_plugin: slides-slidev
```

Notes:

- If `plugins.enabled` is omitted, installed official plugins are enabled by default.
- Use `plugins.disabled` to force-disable this plugin.
- Set `slides.default_plugin` whenever more than one `slides-*` plugin is installed.

## Exported contract

This plugin exports a rich slides workflow contract consumed by backend core and frontend Studio.

### `config_schema`

The plugin declares:

- defaults: `quantity`, `audience`, `structure`, `tone`, `language`, `density`, `themePreset`, `frontmatter`
- options: `quantity_options`, `audience_options`, `structure_options`, `tone_options`, `language_options`, `density_options`, `theme_preset_options`
- engine metadata: `engine="slidev"`
- preview metadata: `preview.kind="external_url"`, `preview.service="slidev"`

### `frontend_bundle`

The plugin exposes frontend bundle metadata so the workspace can select the matching renderer:

- `id="output-slides"`
- `export="render"`
- `meta.engine="slidev"`
- `meta.preview_service="slidev"`

### Preview contract

The current plugin uses the Slidev preview service and declares that through `preview` metadata.
Frontend preview UI reads the active plugin declaration rather than assuming built-in Slidev support.

## Development notes

Use this package as the reference when implementing another `SlidesWorkflowPlugin`:

1. keep workflow-specific generation in the plugin
2. keep draft persistence / streaming orchestration in core
3. expose a complete `config_schema` instead of ad-hoc endpoints
4. declare preview + frontend bundle metadata explicitly
5. keep the plugin id stable as `slides-<engine>`

This change removes the legacy `/v1/workspace/tools/slides/config` path. New plugins should integrate
through `/v1/workspace/tools` and structured slides diagnostics only.
