## Why
Users need a way to remove sources from the Sources panel; currently sources can only be added and persist in the notebook.

## What Changes
- Add a Sources panel action (kebab button beside the select-all control) to remove selected sources.
- Add a backend endpoint to delete multiple sources for a notebook.
- Refresh the Sources list and selection state after deletion.

## Impact
- Spec: `openspec/specs/workspace-ui/spec.md`
- Backend: `backend/py/src/crystalith/api/sources.py`
- Frontend: `frontend/web/src/features/workspace/components/SourcesPanel.tsx`, `frontend/web/src/features/workspace/hooks/useSources.ts`, `frontend/web/src/features/workspace/api.ts`, `frontend/web/src/features/workspace/WorkspacePage.css`
