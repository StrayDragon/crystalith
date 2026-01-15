## ADDED Requirements
### Requirement: TypeScript-first frontend
The frontend codebase must be authored in TypeScript to provide static typing for components and API helpers.

#### Scenario: Frontend entry uses TypeScript
- **WHEN** the frontend is built or tested
- **THEN** the entry and main components compile from `.ts`/`.tsx` sources

### Requirement: Vite-based tooling
The frontend must use Vite for local development and production builds.

#### Scenario: Development server
- **WHEN** a developer runs the frontend dev server
- **THEN** the Vite dev server starts and serves the React app

### Requirement: Feature-based organization
The frontend codebase must organize feature code by feature with colocated components, hooks, and styles.

#### Scenario: Workspace feature structure
- **WHEN** the workspace UI is updated
- **THEN** its components, hooks, API helpers, and styles live under `src/features/workspace`
