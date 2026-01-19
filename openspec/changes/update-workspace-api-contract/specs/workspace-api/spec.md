# Workspace API Contract

## ADDED Requirements
### Requirement: Workspace API contract alignment
The system MUST align workspace API responses with the UI data contract used by the workspace feature.

#### Scenario: Listing notebooks
- **WHEN** the client requests `/v1/notebooks`
- **THEN** each item contains `id`, `name`, and `updated_at` (ISO timestamp) or an agreed alias in a documented mapping

#### Scenario: Listing sessions
- **WHEN** the client requests `/v1/notebooks/{notebook_id}/sessions`
- **THEN** each item contains `id`, `notebook_id`, `title`, `created_at`, and `updated_at`

#### Scenario: Listing messages
- **WHEN** the client requests `/v1/sessions/{session_id}/messages`
- **THEN** each item contains `id`, `session_id`, `role`, `content`, and `citations` in the agreed citation format

### Requirement: Citation envelope consistency
The system MUST use a single citation envelope format across QA, messages, outputs, and refine responses.

#### Scenario: QA response citations
- **WHEN** the client requests `/v1/notebooks/{notebook_id}/qa`
- **THEN** citations use the same envelope format as message and output citations

#### Scenario: Message citations
- **WHEN** the client requests `/v1/sessions/{session_id}/messages`
- **THEN** citations can be parsed without per-endpoint branching

### Requirement: Suggestions contract clarity
The system MUST only issue suggestions requests when the UI surfaces them, and the API shape must be documented.

#### Scenario: Suggestions disabled in UI
- **WHEN** suggestions are not displayed in the workspace UI
- **THEN** the client does not issue suggestions requests

#### Scenario: Suggestions enabled in UI
- **WHEN** suggestions are displayed
- **THEN** `/v1/notebooks/{notebook_id}/suggestions` or `/v1/sessions/{session_id}/suggestions` returns a consistent `suggestions` array with `question`, `type`, and `context`

### Requirement: Search and Deep Research alignment
The system MUST either provide backend endpoints for the Sources search/Deep Research controls or hide those controls.

#### Scenario: Search controls active
- **WHEN** the user submits a Sources search with engine/mode
- **THEN** the backend accepts the query and returns results or a clear not-implemented error with a stable response schema
