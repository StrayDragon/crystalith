## ADDED Requirements

### Requirement: Generic Output Renderer

The frontend MUST provide a `GenericOutputRenderer` component that renders output content based on a `RenderDescriptor` returned by the backend. The renderer MUST support the following layout types:

- `list` — ordered/unordered list of items
- `cards` — card grid layout
- `tree` — hierarchical tree structure
- `timeline` — chronological event timeline
- `sections` — titled sections with content
- `table` — tabular data

Each layout MUST render fields according to the `FieldDescriptor` definitions, supporting field types: `text`, `heading`, `badge`, `list`, `tree`, `date`, `citation`, `code`.

#### Scenario: Plugin output with render_descriptor
- **WHEN** an output has a type not registered in the frontend `pluginRegistry`
- **AND** the backend provides a `render_descriptor` for that output type
- **THEN** `OutputContent` MUST use `GenericOutputRenderer` to render the content
- **AND** the rendered output SHALL follow the layout and field structure defined in the descriptor

#### Scenario: No plugin and no render_descriptor
- **WHEN** an output has a type not registered in the frontend `pluginRegistry`
- **AND** no `render_descriptor` is available
- **THEN** `OutputContent` MUST fall back to rendering raw JSON

#### Scenario: Built-in output type with dedicated plugin
- **WHEN** an output has a type registered in the frontend `pluginRegistry` (e.g., FAQ, GUIDE)
- **THEN** `OutputContent` MUST use the dedicated plugin's `render` function
- **AND** the `GenericOutputRenderer` SHALL NOT be used

#### Scenario: Invalid or unsupported layout type
- **WHEN** a `render_descriptor` contains an unrecognized `layout` value
- **THEN** `GenericOutputRenderer` MUST fall back to rendering raw JSON
- **AND** the component SHALL log a warning to the console

#### Scenario: Nested FieldDescriptor rendering
- **WHEN** a `FieldDescriptor` contains `children` field descriptors
- **THEN** `GenericOutputRenderer` MUST recursively render the nested fields
- **AND** the nesting depth SHALL be limited to prevent infinite recursion

### Requirement: Render Descriptor API Contract

The backend MUST expose `render_descriptor` and `config_schema` information for output types provided by plugins. The frontend MUST handle the presence or absence of these fields gracefully.

The `render_descriptor` MUST conform to the following structure:
- `layout: string` — one of `list`, `cards`, `tree`, `timeline`, `sections`, `table`
- `item_schema: object | null` — describes the fields of each item in the layout
  - `fields: FieldDescriptor[]` — array of field descriptors
- `options: object` — layout-specific options

Each `FieldDescriptor` MUST contain:
- `key: string` — the JSON field name in the output content
- `type: string` — one of `text`, `heading`, `badge`, `list`, `tree`, `date`, `citation`, `code`
- `label: string | null` — optional display label
- `children: FieldDescriptor[]` — optional nested field descriptors

The `config_schema` MUST conform to:
- `quantity_options: ConfigOption[]` — quantity presets
- `difficulty_options: ConfigOption[]` — difficulty presets
- `topic_placeholder: string` — placeholder text
- `supports_topic: boolean` — topic customization support

#### Scenario: Backend returns render_descriptor for plugin output type
- **WHEN** a plugin registers an output type with a `render_descriptor`
- **THEN** the `GET /v1/workspace/tools` endpoint MUST include the `render_descriptor` in the tool's response
- **AND** the descriptor MUST be a valid `RenderDescriptor` object

#### Scenario: Plugin without render_descriptor
- **WHEN** a plugin registers an output type without a `render_descriptor`
- **THEN** the `GET /v1/workspace/tools` endpoint MUST return `null` for the `render_descriptor` field
- **AND** the frontend SHALL fall back to raw JSON rendering for that output type

#### Scenario: Frontend backward compatibility
- **WHEN** the backend has not been updated to include `render_descriptor` in the tools response
- **THEN** the frontend MUST treat the missing field as `null`
- **AND** existing functionality SHALL NOT be affected

### Requirement: Render Descriptor Data Flow

The frontend MUST cache `render_descriptor` data from the workspace tools API and make it available to the `OutputContent` component.

#### Scenario: Render descriptor cached from tools API
- **WHEN** the frontend fetches workspace tools via `GET /v1/workspace/tools`
- **THEN** `normalizeTool()` MUST extract `render_descriptor` from each tool
- **AND** the render descriptors MUST be stored in a lookup map (outputType → renderDescriptor) accessible by `OutputContent`

#### Scenario: OutputContent resolves render_descriptor
- **WHEN** `OutputContent` receives an output with a type not in `pluginRegistry`
- **THEN** it MUST look up the `render_descriptor` from the cached tools data
- **AND** pass it to `GenericOutputRenderer` if available
