## ADDED Requirements
### Requirement: Notebook metadata model
The system SHALL persist notebook metadata using a SQLAlchemy model with relationships to sources and chunks.

#### Scenario: Notebook is created and stored
- **WHEN** a notebook is created with title and owner metadata
- **THEN** a notebook record is stored and can be queried with its sources

### Requirement: Notebook schema compatibility
The system SHALL define notebook columns, indexes, and foreign keys compatible with SQLite and PostgreSQL.

#### Scenario: Cross-database initialization
- **WHEN** the schema is initialized on SQLite or PostgreSQL
- **THEN** notebook tables and indexes are created without vendor-specific failures
