## Why
The logging toolkit was introduced as `lush-logx`, but we want a consistent internal namespace (`cl-*`) for shared packages and future structured log rendering. Renaming now avoids long-term API drift.

## What Changes
- Rename the workspace package `lush-logx` to `cl-logs` and the import path to `cl_logs`.
- Update CLI entry points and tests to the new module name.
- Align workspace dependency wiring with uv (sources/workspace packages).
- **BREAKING**: Any existing imports of `lush_logx` will change to `cl_logs`.

## Impact
- Affected specs: logging
- Affected code: backend/py/packages/lush-logx/* (renamed), backend/py/pyproject.toml
