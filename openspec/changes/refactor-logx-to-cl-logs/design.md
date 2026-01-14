# cl-logs Rename Design

## Goals
- Provide a consistent `cl-*` namespace for shared logging utilities.
- Keep module layout identical to the existing logging API.
- Ensure uv workspace sources resolve to the renamed package.

## Package Mapping
- Workspace package name: `cl-logs`
- Import path: `cl_logs`

## uv Workspace Handling
- Keep `packages/*` workspace membership.
- Add `cl-logs` to `[tool.uv.sources]` in `backend/py/pyproject.toml`.
- Ensure internal dependencies use `cl-stdx` to match available workspace packages.

## Compatibility
- This change is **breaking**; external imports must use `cl_logs`.
