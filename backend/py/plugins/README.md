## Official plugins (workspace packages)

This directory contains **official Crystalith plugin packages**.

- Each subdirectory is an independently installable Python package that exposes one or more
  `crystalith.plugins` entry points.
- The core service MUST NOT import these packages directly; they are discovered at runtime via
  entry points and can be enabled/disabled via `config/app.yaml`.
- Installation guidance is documented here for the common self-host paths.

### Plugin ids

Official plugin ids follow a stable naming convention:

- Output types: `output-<type>` (e.g. `output-quiz`)
- Parsers: `parser-<kind>` (e.g. `parser-pdf`)
- Web extractors: `extractor-<kind>` (e.g. `extractor-trafilatura`)
- Slides workflow plugins: `slides-<engine>` (e.g. `slides-slidev`)
- Source connectors: `connector-<kind>` (e.g. `connector-obsidian`)

### Default enablement

- If an official plugin package is installed and `plugins.enabled` is empty, it is enabled by default.
- Operators can use `plugins.enabled` (allowlist) and `plugins.disabled` (denylist) to control what loads.

### Self-host install notes

For the official Slidev-backed slides workflow plugin:

- Package: `crystalith-slides-slidev`
- Plugin id: `slides-slidev`
- Recommended install extra: `crystalith[official-slides]`

Example install flows:

```bash
cd backend/py
uv sync --extra official-slides
```

For official source connector plugins:

```bash
cd backend/py
uv sync --extra official-connectors
```

Or install the plugin package directly during local development:

```bash
cd backend/py
uv pip install ./plugins/crystalith-slides-slidev
```

Example config:

```yaml
plugins:
  enabled:
    - slides-slidev

slides:
  default_plugin: slides-slidev
```

If `plugins.enabled` is omitted, an installed official plugin still loads by default. Set
`slides.default_plugin` when multiple `slides-*` plugins are installed so the active workflow is
selected deterministically.
