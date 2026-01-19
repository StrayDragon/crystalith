## MODIFIED Requirements
### Requirement: Workspace layout and navigation
The system MUST present a NotebookLM-style three-column workspace on desktop with Sources, Chat, and Studio panels side-by-side, and a single-column stacked layout on smaller screens without tab switching.

#### Scenario: Desktop layout
- **WHEN** the viewport is at or above the desktop breakpoint
- **THEN** Sources, Chat, and Studio panels are visible side-by-side with fixed side widths and independent scrolling regions

#### Scenario: Mobile layout
- **WHEN** the viewport is below the desktop breakpoint
- **THEN** panels stack vertically in a single column and remain accessible without tabs

## ADDED Requirements
### Requirement: NotebookLM-style top bar
The system MUST show a compact top bar with a document title on the left and action controls on the right.

#### Scenario: Rendering the top bar
- **WHEN** the workspace loads
- **THEN** the title and action controls are visible and aligned to match the reference layout

### Requirement: Sources panel composition
The Sources panel MUST include an add-source CTA, a Deep Research callout, a search row with engine + mode selectors, and a selectable source list.

#### Scenario: Sources panel layout
- **WHEN** the Sources panel is visible
- **THEN** the CTA, callout, search controls, and source list appear in the defined order

### Requirement: Chat panel composition
The Chat panel MUST include a conversation area, a lightweight action row, and a bottom input composer with a send affordance.

#### Scenario: Chat panel layout
- **WHEN** the Chat panel is visible
- **THEN** messages render in the conversation area, the action row appears below the content, and the composer sits at the bottom

### Requirement: Studio panel composition
The Studio panel MUST provide a tool grid (with optional Beta badges), a notes list with metadata, and a persistent add-note button.

#### Scenario: Studio panel layout
- **WHEN** the Studio panel is visible
- **THEN** tool tiles render in a grid above the notes list and the add-note button
