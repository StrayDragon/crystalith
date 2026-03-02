# Rust SDK

## Overview
The Rust SDK is generated from the backend OpenAPI schema via Fern and stored in:

- `vendor/crystalith-sdks/rust` (git submodule)

Fern configuration lives in:
- `sdk/configs/fern/fern.config.json`
- `sdk/configs/fern/generators.yml` (group: `rust-sdk`)

## Local generation (repo)

```bash
git submodule update --init --recursive vendor/crystalith-sdks
just api-export
just sdk-gen-rust
```

## Versioning / publishing notes
- Crate name is configured as `crystalith-sdk`.
- Version is aligned with `backend/py/pyproject.toml` (the `just sdk-gen-rust` recipe enforces this).
