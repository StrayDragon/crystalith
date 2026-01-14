# Workspace UI

## Requirements

### Requirement: Workspace layout and navigation
The system must present a three-panel workspace on desktop and a tab-switched layout on smaller screens.

#### Scenario: Desktop layout
- **WHEN** the viewport is at or above the desktop breakpoint
- **THEN** Sources, Chat, and Output panels are visible side-by-side

#### Scenario: Mobile layout
- **WHEN** the viewport is below the desktop breakpoint
- **THEN** only the active panel is visible and users can switch panels via tabs

### Requirement: Tailwind-driven styling
The system must use Tailwind CSS for workspace styling to keep the visual system consistent and maintainable.

#### Scenario: Workspace renders with Tailwind styles
- **WHEN** the workspace page loads
- **THEN** the header, panels, buttons, and forms render with Tailwind-based styles

### Requirement: Chat interaction clarity
The system must present messages and input controls with clear hierarchy and accessible focus states.

#### Scenario: Reviewing messages
- **WHEN** a user reads the chat history
- **THEN** user and assistant messages are visually distinct and easy to scan

#### Scenario: Composing input
- **WHEN** a user focuses the chat input
- **THEN** the input shows a visible focus ring and primary action is clearly emphasized

### Requirement: Motion and accessibility
The system must avoid distracting continuous animations and respect reduced motion preferences.

#### Scenario: Reduced motion preference
- **WHEN** the user has `prefers-reduced-motion` enabled
- **THEN** decorative animations are disabled
