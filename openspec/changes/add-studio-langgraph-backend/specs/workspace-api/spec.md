## ADDED Requirements
### Requirement: Studio tool catalog
The system MUST expose a Studio tool catalog at `GET /v1/workspace/tools`, returning a list of tools with id, label, description, tone, output_type, prompt, optional badge, and enabled state.

#### Scenario: Retrieve Studio tool catalog
- **WHEN** the client requests `GET /v1/workspace/tools`
- **THEN** the response returns a tool list with the required fields for each tool

### Requirement: Studio output generation
The system MUST provide `POST /v1/notebooks/{notebook_id}/outputs/{output_type}` to generate a structured output for the notebook and persist it for later retrieval.

#### Scenario: Generate notebook output
- **WHEN** a valid notebook id and output_type are provided
- **THEN** the response returns status 201 with a persisted output record including type, content, citations, and timestamps

### Requirement: Studio output history list
The system MUST provide `GET /v1/notebooks/{notebook_id}/outputs` to list outputs, ordered by newest first, and support pagination.

#### Scenario: List output history
- **WHEN** a notebook has multiple outputs
- **THEN** the response returns outputs ordered by newest first and respects offset/limit

### Requirement: Studio output detail
The system MUST provide `GET /v1/notebooks/{notebook_id}/outputs/{output_id}` to fetch a single output record by id.

#### Scenario: Fetch output detail
- **WHEN** a valid output_id exists for the notebook
- **THEN** the response returns the output record with content and metadata

### Requirement: Studio suggestions
The system MUST provide suggestions for notebooks and sessions via `POST /v1/notebooks/{notebook_id}/suggestions` and `POST /v1/sessions/{session_id}/suggestions`.

#### Scenario: Generate notebook suggestions
- **WHEN** a notebook suggestion request is submitted
- **THEN** the response returns suggestions with question, type, and context

#### Scenario: Generate deep-dive suggestions
- **WHEN** a suggestion request uses `mode=deep_dive`
- **THEN** the response returns deep_dive suggestions using the seed question

### Requirement: Studio search / Deep Research
The system MUST provide `POST /v1/notebooks/{notebook_id}/sources/search` to return a summary message and stubbed search results for the requested query.

#### Scenario: Search request summary
- **WHEN** a search request is submitted with query, engine, and mode
- **THEN** the response returns status, results, and a concise summary message
