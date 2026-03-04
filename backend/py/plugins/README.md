## Official plugins (workspace packages)

This directory contains **official Crystalith plugin packages**.

- Each subdirectory is an independently installable Python package that exposes one or more
  `crystalith.plugins` entry points.
- The core service MUST NOT import these packages directly; they are discovered at runtime via
  entry points and can be enabled/disabled via `config/app.yaml`.
- Installation guidance is documented at the repo level (core-only vs official-full bundles).

### Plugin ids

Official plugin ids follow a stable naming convention:

- Output types: `output-<type>` (e.g. `output-quiz`)
- Parsers: `parser-<kind>` (e.g. `parser-pdf`)
- Web extractors: `extractor-<kind>` (e.g. `extractor-trafilatura`)

### Default enablement

- If an official plugin package is installed and `plugins.enabled` is empty, it is enabled by default.
- Operators can use `plugins.enabled` (allowlist) and `plugins.disabled` (denylist) to control what loads.
