# Replace chat UI envelope with Rivu

## Why
Crystalith currently serializes UI mounts into assistant `message.content` using `[[crystalith-ui:v1]]` markers. This couples presentation with answer text, makes SSE/state sync brittle, and blocks server-authoritative interactive UI.

## What
- Remove the old chat UI envelope end-to-end.
- Introduce server-authoritative `shared_state.ui` backed by Rivu.
- Render message mounts in the frontend with `rivu-react`.
- Add stable backend message IDs and UI event handling.

## Verification
- No response or stored message contains `[[crystalith-ui:v1]]`.
- QA non-stream returns pure `answer` plus `shared_state`.
- QA stream emits `state_snapshot`/`state_delta` plus `done` metadata with stable `message_id`.
- Frontend renders mounts below assistant bubbles via Rivu.
