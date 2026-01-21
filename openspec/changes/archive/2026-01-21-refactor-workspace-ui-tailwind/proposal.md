## Why
The workspace UI needs clearer visual hierarchy and a more polished chat interaction area. Introducing Tailwind CSS will reduce custom styling complexity and make future UI iteration faster.

## What Changes
- Introduce Tailwind CSS and its build config in the frontend.
- Rework workspace UI styling to use Tailwind utilities and component layers.
- Refresh the chat/text interaction area (message layout, input focus, feedback states).
- Simplify legacy CSS by consolidating into Tailwind-driven styles.

## Impact
- Affected specs: workspace-ui
- Affected code: frontend/web/src/workspace/WorkspacePage.js, frontend/web/src/workspace/workspace.css, frontend/web/src/index.css, frontend/web/package.json, frontend/web/tailwind.config.js, frontend/web/postcss.config.js
