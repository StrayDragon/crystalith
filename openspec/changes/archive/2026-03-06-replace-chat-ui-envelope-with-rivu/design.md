# Design

## Core model
- Persist session-level `shared_state` JSON and `shared_state_revision` integer.
- Keep Rivu upstream payload naming (`clientRequestId`, `baseRevision`) inside `ui.v1.event` only.
- Keep Crystalith transport fields in `snake_case`.
- `message.id` in frontend is always `String(message_id)` from backend.

## Backend
- Remove `chat_ui_envelope.py` and all embed/strip logic.
- Non-stream QA returns `answer`, `shared_state`, `shared_state_revision`, `message_id` and metadata.
- Stream QA creates provisional assistant message, emits `state_snapshot`, then `done` with `message_id` and metadata.
- If streaming ends before `done`, rollback provisional assistant message and any related mounts.
- Add `GET .../ui/state` and `POST .../ui/event` with server-side validation and idempotency.

## Frontend
- Remove envelope parsing/registry.
- Keep assistant message content as plain markdown text only.
- Maintain a session-scoped Rivu kernel/registry/host and dispatch backend snapshots/deltas.
- Render mounts beneath each assistant bubble by `message.id` and slot `inline`.
