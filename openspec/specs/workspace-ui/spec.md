# Workspace UI

## Purpose

定义 Crystalith 前端工作区界面的布局、交互和样式要求，包括三栏布局、响应式设计、Sources/Chat/Studio 面板组成以及 Tailwind CSS 驱动的样式系统。

## Requirements

### Requirement: Workspace layout and navigation
The system must present a NotebookLM-style three-panel workspace on desktop with draggable side panels, and a stacked single-column layout on smaller screens without tabs.

#### Scenario: Desktop layout
- **WHEN** the viewport is at or above the desktop breakpoint
- **THEN** Sources, Chat, and Studio panels are visible side-by-side with independent scrolling regions

#### Scenario: Resizing side panels
- **WHEN** the user drags a side-panel resize handle
- **THEN** the corresponding panel width updates within defined bounds and the chat panel remains usable

#### Scenario: Mobile layout
- **WHEN** the viewport is below the desktop breakpoint
- **THEN** panels stack vertically and resize handles are hidden or disabled

### Requirement: NotebookLM-style top bar
The system must show a compact top bar with a document title on the left and action controls on the right.

#### Scenario: Rendering the top bar
- **WHEN** the workspace loads
- **THEN** the title and action controls are visible and aligned to match the reference layout

### Requirement: Sources panel composition
The Sources panel must include an add-source CTA, a Deep Research callout, a search row with engine + mode selectors, and a selectable source list.

#### Scenario: Sources panel layout
- **WHEN** the Sources panel is visible
- **THEN** the CTA, callout, search controls, and source list appear in the defined order

### Requirement: Chat panel composition
The Chat panel must include a conversation area, a lightweight action row, and a bottom input composer with a send affordance.

#### Scenario: Chat panel layout
- **WHEN** the Chat panel is visible
- **THEN** messages render in the conversation area, the action row appears below the content, and the composer sits at the bottom

### Requirement: Studio panel composition
The Studio panel must provide a tool grid (with optional Beta badges), a notes list with metadata, and a persistent add-note button.

#### Scenario: Studio panel layout
- **WHEN** the Studio panel is visible
- **THEN** tool tiles render in a grid above the notes list and the add-note button

### Requirement: Studio tool grid responsiveness
The Studio tool grid must render square tiles that adapt to available width and keep icon/label sizing readable.

#### Scenario: Narrow Studio panel
- **WHEN** the Studio panel width is reduced
- **THEN** tool tiles wrap to fewer columns and labels remain readable without clipping

### Requirement: Tailwind-driven styling
The system must use Tailwind CSS for workspace styling to keep the visual system consistent and maintainable.

#### Scenario: Workspace renders with Tailwind styles
- **WHEN** the workspace page loads
- **THEN** the header, panels, buttons, and forms render with Tailwind-based styles

### Requirement: Motion and accessibility
The system must avoid distracting continuous animations and respect reduced motion preferences.

#### Scenario: Reduced motion preference
- **WHEN** the user has `prefers-reduced-motion` enabled
- **THEN** decorative animations are disabled
