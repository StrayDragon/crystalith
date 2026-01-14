# cl-logs Rename Design

## Goals
- Provide a consistent `cl-*` namespace for shared logging utilities.
- Keep module layout identical to the existing `lush_logx` API.
- Ensure uv workspace sources resolve to the renamed package.

## Package Mapping
- Workspace package name: `lush-logx` → `cl-logs`
- Import path: `lush_logx` → `cl_logs`
- CLI entry point: `lush-logx-cli-log-parser` → `cl-logs-cli-log-parser`

## uv Workspace Handling
- Keep `packages/*` workspace membership.
- Add `cl-logs` to `[tool.uv.sources]` in `backend/py/pyproject.toml`.
- Replace internal dependency on `lush-stdx` with `cl-stdx` to match available workspace packages.

## Compatibility
- This change is **breaking** for any external imports referencing `lush_logx`.
