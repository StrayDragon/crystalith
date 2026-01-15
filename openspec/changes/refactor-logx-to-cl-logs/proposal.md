## Why
The logging toolkit should use a consistent internal namespace (`cl-*`) for shared packages and future structured log rendering. Renaming now avoids long-term API drift.

## What Changes
- Ensure the workspace package is `cl-logs` with the `cl_logs` import path.
- Align workspace dependency wiring with uv (sources/workspace packages).
- **BREAKING**: Imports must use `cl_logs`.

## Impact
- Affected specs: logging
- Affected code: backend/py/packages/cl-logs/*, backend/py/pyproject.toml
