## RENAMED Requirements

### Requirement: Logging toolkit package naming
The system must expose the logging toolkit as `cl-logs` with a `cl_logs` import path.

#### Scenario: Importing the logging toolkit
- **WHEN** a developer imports the logging toolkit
- **THEN** they use `cl_logs` instead of `lush_logx`

### Requirement: CLI entry point naming
The system must expose the log parser CLI under the `cl-logs-cli-log-parser` entry point.

#### Scenario: Running the CLI
- **WHEN** a developer runs the log parser CLI
- **THEN** they use the `cl-logs-cli-log-parser` command

## MODIFIED Requirements

### Requirement: Workspace dependency wiring
The system must register the logging package in the uv workspace sources so it resolves as a local dependency.

#### Scenario: Installing workspace dependencies
- **WHEN** dependencies are resolved via uv
- **THEN** `cl-logs` is sourced from the workspace packages
