## ADDED Requirements
### Requirement: Source metadata model
The system SHALL persist source metadata using a SQLAlchemy model linked to its notebook and chunks.

#### Scenario: Source is created and linked to notebook
- **WHEN** a source is ingested for a notebook
- **THEN** a source record is stored and linked to the notebook

### Requirement: Chunk metadata model
The system SHALL persist chunk metadata using a SQLAlchemy model linked to its source.

#### Scenario: Chunks are created for a source
- **WHEN** a source is chunked during ingestion
- **THEN** chunk records are stored and linked to the source

### Requirement: Source and chunk schema compatibility
The system SHALL define source and chunk columns, indexes, and foreign keys compatible with SQLite and PostgreSQL.

#### Scenario: Cross-database initialization
- **WHEN** the schema is initialized on SQLite or PostgreSQL
- **THEN** source and chunk tables and indexes are created without vendor-specific failures
