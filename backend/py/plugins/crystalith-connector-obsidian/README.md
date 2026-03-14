# crystalith-connector-obsidian

Official Crystalith `SourceConnectorPlugin` for importing notes from an Obsidian vault directory.

## Plugin id

- `connector-obsidian`

## Install

- `pip install 'crystalith[official-connectors]'` (or `crystalith[official-full]`)
- Local dev: `cd backend/py && uv sync --extra official-connectors`

## Configuration

Connection config schema:

- `vault_path` (string, required): local directory path to the Obsidian vault (must be readable by the backend process).

Docker Compose note: the connector reads from the backend filesystem. Mount your vault into the API container and use the **container path**:

```yaml
services:
  api:
    volumes:
      - /path/to/MyVault:/vault:ro
```

Then set `vault_path: /vault` when creating the binding.

## Snapshot behavior

- Enumerates `*.md` / `*.markdown` under the vault root.
- Returns `relative_path`, `size_bytes`, `modified_at` (ISO 8601), and `frontmatter_summary` (`title/tags/aliases/date` when present).

## Read behavior

- `read_file_bytes()` reads bytes for a selected `relative_path` under the vault root.
- Path traversal is rejected (host additionally normalizes/validates paths).
