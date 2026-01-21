## ADDED Requirements

### Requirement: Studio output detail view
The system MUST provide a Studio output detail view that shows the selected output content alongside a preview list of other outputs.

#### Scenario: Open output detail view
- **WHEN** the user selects an output from the Studio notes list
- **THEN** a detail view appears with the selected output content and a preview list of outputs

#### Scenario: Switch outputs from preview list
- **WHEN** the user selects a different output in the preview list
- **THEN** the detail view updates to show the newly selected output content

#### Scenario: Toggle fullscreen
- **WHEN** the user activates fullscreen mode in the output detail view
- **THEN** the detail view expands to fill the viewport and can be exited back to the workspace
