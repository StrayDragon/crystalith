## MODIFIED Requirements
### Requirement: Workspace layout and navigation
The system MUST allow desktop users to resize the left and right panels via draggable split handles while keeping the center panel usable.

#### Scenario: Resizing side panels
- **WHEN** the user drags the left or right split handle on a desktop viewport
- **THEN** the corresponding panel width updates within defined min/max bounds and the chat panel remains visible

#### Scenario: Mobile layout
- **WHEN** the viewport is below the desktop breakpoint
- **THEN** panels stack vertically and resize handles are hidden or disabled

## ADDED Requirements
### Requirement: Studio tool grid responsiveness
The Studio tool grid MUST render square tiles that auto-fit to the available panel width and keep labels readable.

#### Scenario: Narrow Studio panel
- **WHEN** the Studio panel width is reduced
- **THEN** tool tiles wrap to fewer columns while keeping labels readable
