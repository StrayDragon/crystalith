# Workspace UI Refresh (Tailwind)

## Visual Direction
- **Style:** Glassmorphism + Swiss grid structure.
- **Palette:** cool slate base with blue primary and warm orange highlight.
- **Typography:** Space Grotesk for headings/UI, Noto Sans SC for body text.
- **Background:** layered radial gradients + subtle texture for depth.

## Layout
- 3-column workspace on desktop; stacked panels on mobile.
- Each panel is a glass card with rounded corners, soft shadow, and clear sectioning.

## Chat/Text Interaction Area
- Message stream in a scrollable column with distinct user/assistant bubbles.
- Emphasized focus states for input and action buttons.
- Citation hover highlight uses a visible ring without layout shift.

## Motion & Accessibility
- Page-load and panel-entry animations only, using `motion-safe` utilities.
- Respect `prefers-reduced-motion` by disabling animations.
- Maintain WCAG-friendly contrast in light mode.

## Tailwind Integration
- Tailwind base/components/utilities in `index.css`.
- Component styling consolidated via `@layer components` in `workspace.css` using `@apply`.
- Custom tokens in `tailwind.config.js` for color, shadow, and animation.
