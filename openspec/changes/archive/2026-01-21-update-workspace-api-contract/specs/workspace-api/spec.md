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

### Requirement: Studio tool catalog configuration
The system MUST expose a text-only Studio tool catalog so the UI can render cards and output type options from API data.

#### Scenario: Listing tool cards
- **WHEN** the client requests `/v1/workspace/tools`
- **THEN** the response includes a `tools` array with `id`, `label`, `description`, `tone`, `output_type`, `prompt`, and optional `badge` and `enabled`

#### Scenario: Text-only tool types
- **WHEN** the tools list is returned
- **THEN** `output_type` values are limited to `FAQ`, `GUIDE`, `TIMELINE`, `MINDMAP`, `QUIZ`, and `BRIEFING` for v1

### Requirement: Per-output generation endpoints
The system MUST provide a dedicated endpoint per output type for creating outputs, while keeping output listing available.

#### Scenario: Generating an output by type
- **WHEN** the client posts to `/v1/notebooks/{notebook_id}/outputs/{output_type}` with `prompt` and optional `chunk_ids`
- **THEN** the response returns an output record with `id`, `notebook_id`, `type`, `prompt`, `chunk_ids`, `content`, `created_at`, and `updated_at`

#### Scenario: Listing outputs
- **WHEN** the client requests `/v1/notebooks/{notebook_id}/outputs`
- **THEN** the response returns outputs ordered by newest first for Studio notes display

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
The system MUST provide backend support for Sources search and Deep Research with a stable response schema.

#### Scenario: Search controls active
- **WHEN** the user submits a Sources search with engine/mode
- **THEN** the backend accepts the query and returns `status: ok`, `results`, and an optional `message` summary

#### Scenario: Deep Research mode
- **WHEN** the search mode is `Deep Research`
- **THEN** the response includes a `message` summary and a `results` array (which may be empty)

## REMOVED Requirements
### Requirement: Audio/Video overview endpoints
**Reason**: v1 is text-only and removes non-text overview capabilities.
**Migration**: Remove `/v1/notebooks/{notebook_id}/audio-overview` and `/v1/notebooks/{notebook_id}/video-overview` endpoints and UI entry points.

#### Scenario: Audio/Video endpoints removed
- **WHEN** a client requests the removed overview endpoints
- **THEN** the API responds with `404 Not Found`
