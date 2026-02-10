## MODIFIED Requirements

### Requirement: Output Generation Pipeline

The system MUST generate structured outputs via `OutputGraph` (ResolveContext → GenerateOutput → MapCitations → PersistOutput). The `GenerateOutput` node MUST select schema and default_prompt with the following priority:

1. If `PluginRegistry.output_types` contains a matching `OutputTypePlugin` for the given `output_type`, the system MUST use the plugin-provided `schema` and `default_prompt`.
2. Otherwise, the system MUST fall back to the core `OUTPUT_SCHEMAS` and `DEFAULT_PROMPTS`.

#### Scenario: Plugin overrides output type schema
- **WHEN** an `OutputTypePlugin` registers `output_type = "QUIZ"` with a custom `schema` and `default_prompt`
- **THEN** `GenerateOutput` MUST use the plugin's schema and prompt instead of the core fallback
- **AND** the generated output content conforms to the plugin schema structure

#### Scenario: Fallback when no plugin is installed
- **WHEN** no `OutputTypePlugin` registers `output_type = "QUIZ"`
- **THEN** `GenerateOutput` MUST use `OUTPUT_SCHEMAS[OutputType.QUIZ]` and `DEFAULT_PROMPTS[OutputType.QUIZ]`

#### Scenario: Plugin provides metadata
- **WHEN** an `OutputTypePlugin` provides `metadata` (containing `description`, `display_text`, `tone`)
- **THEN** `PluginRegistry` MUST record the metadata
- **AND** the metadata SHALL be accessible via `registry.get_output_type_metadata()`

## ADDED Requirements

### Requirement: OutputTypePlugin Optional Extension Attributes

The `OutputTypePlugin` Protocol MUST remain unchanged (only `output_type`, `schema`, `default_prompt`). The system MUST support optional extension attributes detected via `getattr()` at registration time:

- `metadata: OutputTypePluginMeta | None` — display metadata (description, display_text, tone)
- `render_descriptor: RenderDescriptor | None` — frontend rendering layout description
- `config_schema: PluginConfigSchema | None` — generation dialog configuration

The `PluginRegistry` MUST store these extension attributes in separate dictionaries, keyed by `output_type`.

#### Scenario: Plugin provides all extension attributes
- **WHEN** a plugin provides `metadata`, `render_descriptor`, and `config_schema`
- **THEN** the registry MUST store all three attributes
- **AND** they SHALL be retrievable via `get_output_type_metadata()`, `get_render_descriptor()`, `get_config_schema()`

#### Scenario: Plugin provides no extension attributes
- **WHEN** a plugin does not define `metadata`, `render_descriptor`, or `config_schema`
- **THEN** the plugin MUST still register normally via the base Protocol
- **AND** `getattr()` calls for missing attributes MUST return `None`
- **AND** the system SHALL use core defaults where applicable

#### Scenario: Plugin provides invalid extension attribute types
- **WHEN** a plugin defines `metadata` but it is not an `OutputTypePluginMeta` instance
- **THEN** the compliance checker MUST report a warning
- **AND** the registry MUST ignore the invalid attribute and treat it as absent

### Requirement: Output Type Plugin Conflict Handling

When multiple plugins register the same `output_type`, the system MUST handle the conflict gracefully.

#### Scenario: Two plugins register the same output_type
- **WHEN** plugin A registers `output_type = "QUIZ"` and plugin B also registers `output_type = "QUIZ"`
- **THEN** the registry MUST overwrite plugin A with plugin B (last-wins)
- **AND** the registry MUST log a warning message indicating the conflict

### Requirement: OutputTypePlugin Render Descriptor Support

The `OutputTypePlugin` MAY provide an optional `render_descriptor` attribute of type `RenderDescriptor`. The render descriptor describes how the frontend SHALL render the plugin's output content using generic layout components.

The `RenderDescriptor` MUST contain:
- `layout: str` — one of `list`, `cards`, `tree`, `timeline`, `sections`, `table`
- `item_schema: ItemSchema | None` — describes the fields of each item
- `options: dict` — layout-specific options

When a plugin provides a `render_descriptor`, the backend MUST include it in API responses so the frontend can render the output without a dedicated component.

#### Scenario: Plugin provides render_descriptor
- **WHEN** a plugin sets `render_descriptor` with `layout="cards"` and field descriptors
- **THEN** the registry MUST store the render_descriptor
- **AND** the API MUST include it in the workspace tools response

#### Scenario: Plugin without render_descriptor
- **WHEN** a plugin does not set `render_descriptor` (or sets it to `None`)
- **THEN** the plugin MUST still register normally
- **AND** the frontend SHALL fall back to raw JSON rendering

### Requirement: OutputTypePlugin Config Schema Support

The system MUST support an optional `config_schema` attribute on `OutputTypePlugin` of type `PluginConfigSchema`. The config schema describes the generation dialog options (quantity, difficulty, topic support, etc.) for the frontend.

The `PluginConfigSchema` MUST contain:
- `quantity_options: list[ConfigOption]` — quantity presets
- `difficulty_options: list[ConfigOption]` — difficulty presets
- `topic_placeholder: str` — placeholder text for topic input
- `supports_topic: bool` — whether the output type supports topic customization

#### Scenario: Plugin provides config_schema
- **WHEN** a plugin sets `config_schema` with quantity and difficulty options
- **THEN** the registry MUST store the config_schema
- **AND** the API MUST include it in the workspace tools response

#### Scenario: Plugin without config_schema
- **WHEN** a plugin does not set `config_schema`
- **THEN** the frontend SHALL use default generation dialog options

### Requirement: Output Type Plugin Package Structure

Each output type plugin package MUST:
1. Be an independent Python package registered via `entry_points` under `crystalith.plugins`
2. Implement the `OutputTypePlugin` protocol, providing `output_type`, `schema`, and `default_prompt`
3. The plugin's `schema` MUST be a `pydantic.BaseModel` subclass
4. The plugin's `output_type` MUST match one of the core `OutputType` enum values
5. The plugin MUST NOT import from `crystalith.shared.agents.output_schemas` (schema independence)

#### Scenario: QUIZ output type plugin
- **WHEN** `crystalith-output-quiz` plugin is installed and enabled
- **THEN** the plugin MUST register `output_type = "QUIZ"`
- **AND** provide a self-contained `QuizOutput` schema and a corresponding default_prompt

#### Scenario: TIMELINE output type plugin
- **WHEN** `crystalith-output-timeline` plugin is installed and enabled
- **THEN** the plugin MUST register `output_type = "TIMELINE"`
- **AND** provide a self-contained `TimelineOutput` schema and a corresponding default_prompt

#### Scenario: MINDMAP output type plugin
- **WHEN** `crystalith-output-mindmap` plugin is installed and enabled
- **THEN** the plugin MUST register `output_type = "MINDMAP"`
- **AND** provide a self-contained `MindmapOutput` schema and a corresponding default_prompt

### Requirement: Render Types Module

The system MUST provide a `shared/plugins/render_types.py` module containing the Pydantic models for extension attributes:
- `OutputTypePluginMeta`
- `RenderDescriptor`, `ItemSchema`, `FieldDescriptor`
- `PluginConfigSchema`, `ConfigOption`

These models MUST be importable by plugin packages without requiring the full core application as a dependency.

#### Scenario: Plugin imports render_types
- **WHEN** a plugin package imports `RenderDescriptor` from `crystalith.shared.plugins.render_types`
- **THEN** the import MUST succeed without requiring other core modules
