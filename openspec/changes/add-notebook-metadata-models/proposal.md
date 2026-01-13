# Change: Add notebook metadata models

## Why
The platform needs persisted metadata models for notebooks, their sources, and ingestion chunks to support notebook management and source ingestion workflows.

## What Changes
- Add SQLAlchemy models and relations for Notebook, Source, and Chunk.
- Define cross-database compatible column types, indexes, and foreign key delete behavior.
- Document schema initialization via `create_all` and migration tooling.

## Impact
- Affected specs: notebook-management, source-ingestion
- Affected code: backend database models and schema setup
