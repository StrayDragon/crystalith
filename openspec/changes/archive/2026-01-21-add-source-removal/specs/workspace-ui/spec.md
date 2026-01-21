## MODIFIED Requirements
### Requirement: Sources panel composition
The Sources panel MUST include an add-source CTA, a Deep Research callout, a search row with engine + mode selectors, an action control for selected sources, and a selectable source list.

#### Scenario: Sources panel layout
- **WHEN** the Sources panel is visible
- **THEN** the CTA, callout, search controls, action controls, and source list appear in the defined order

#### Scenario: Sources action control
- **WHEN** the Sources panel shows selectable sources
- **THEN** a kebab action button appears next to the select-all control to manage selected sources

## ADDED Requirements
### Requirement: Source removal from the Sources panel
The system MUST allow users to remove one or more selected sources from a notebook via the Sources panel.

#### Scenario: Remove selected sources
- **WHEN** the user selects sources and triggers the remove action
- **THEN** the selected sources are deleted and no longer appear in the Sources list

#### Scenario: Removal disabled in demo or empty selection
- **WHEN** no sources are selected or the workspace is in demo mode
- **THEN** the remove action is disabled
