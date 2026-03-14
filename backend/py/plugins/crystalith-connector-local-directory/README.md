# crystalith-connector-local-directory

Official Crystalith `SourceConnectorPlugin` for importing files from a local directory.

## Plugin id

- `connector-local-directory`

## Install

- `pip install 'crystalith[official-connectors]'` (or `crystalith[official-full]`)
- Local dev: `cd backend/py && uv sync --extra official-connectors`

## Configuration

Connection config schema:

- `root_path` (string, required): local directory path (must be readable by the backend process).

Docker Compose note: the connector reads from the backend filesystem. Mount your directory into the API container and use the **container path**.

## Snapshot behavior

- Enumerates common ingestion-friendly file types under `root_path` (e.g. Markdown, text, CSV, HTML, PDF, audio/video).
- For Markdown, `frontmatter_summary` is extracted when present; other file types return an empty `frontmatter_summary`.

## Read behavior

- `read_file_bytes()` reads bytes for a selected `relative_path` under the root directory.
- Path traversal is rejected (host additionally normalizes/validates paths).
