## RENAMED Requirements

### Requirement: Logging toolkit package naming
The system must expose the logging toolkit as `cl-logs` with a `cl_logs` import path.

#### Scenario: Importing the logging toolkit
- **WHEN** a developer imports the logging toolkit
- **THEN** they use `cl_logs`

## MODIFIED Requirements

### Requirement: Workspace dependency wiring
The system must register the logging package in the uv workspace sources so it resolves as a local dependency.

#### Scenario: Installing workspace dependencies
- **WHEN** dependencies are resolved via uv
- **THEN** `cl-logs` is sourced from the workspace packages
