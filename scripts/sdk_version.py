#!/usr/bin/env python3
"""SDK version utilities: read backend version, validate SDK consistency.

Usage:
    scripts/sdk_version.py get-backend
        Print the backend version from backend/py/pyproject.toml.

    scripts/sdk_version.py validate VERSION
        Validate that VERSION matches the backend version. Exit 1 on mismatch.

    scripts/sdk_version.py check-all
        Check that all SDK versions (python, typescript, rust) match the backend.

    scripts/sdk_version.py check-schema SCHEMA_PATH
        Exit 1 if the OpenAPI schema file does not exist.

    scripts/sdk_version.py check-fern
        Exit 1 if the fern CLI is not installed.

    scripts/sdk_version.py set-ts-version VERSION
        Update the version field in the TypeScript SDK package.json.
"""

from __future__ import annotations

import json
import pathlib
import re
import shutil
import sys
import tomllib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def get_backend_version() -> str:
    text = (ROOT / "backend/py/pyproject.toml").read_text()
    data = tomllib.loads(text)
    return data["project"]["version"]


def get_python_sdk_version() -> str:
    text = (ROOT / "vendor/crystalith-sdks/python/pyproject.toml").read_text()
    return tomllib.loads(text)["project"]["version"]


def get_python_sdk_file_version() -> str:
    return (ROOT / "vendor/crystalith-sdks/python/.sdk-version").read_text().strip()


def get_ts_sdk_version() -> str:
    data = json.loads((ROOT / "vendor/crystalith-sdks/typescript/package.json").read_text())
    return data["version"]


def get_rust_sdk_version() -> str:
    text = (ROOT / "vendor/crystalith-sdks/rust/Cargo.toml").read_text()
    return tomllib.loads(text)["package"]["version"]


def cmd_get_backend() -> None:
    print(get_backend_version())


def cmd_validate(version: str) -> None:
    backend = get_backend_version()
    if version and version != backend:
        print(
            f"SDK_VERSION ({version}) must match backend version ({backend})",
            file=sys.stderr,
        )
        sys.exit(1)


def cmd_check_all() -> None:
    backend = get_backend_version()
    checks: list[tuple[str, str]] = [
        ("vendor/crystalith-sdks/python/pyproject.toml", get_python_sdk_version()),
        ("vendor/crystalith-sdks/python/.sdk-version", get_python_sdk_file_version()),
        ("vendor/crystalith-sdks/typescript/package.json", get_ts_sdk_version()),
        ("vendor/crystalith-sdks/rust/Cargo.toml", get_rust_sdk_version()),
    ]
    ok = True
    for label, ver in checks:
        if ver != backend:
            print(f"SDK version mismatch: backend/py={backend} {label}={ver}", file=sys.stderr)
            ok = False
    if ok:
        print(f"SDK version OK: {backend}")
    else:
        sys.exit(1)


def cmd_check_schema(schema_path: str) -> None:
    if not pathlib.Path(schema_path).exists():
        print(f"OpenAPI schema not found at {schema_path}. Run: just api-export", file=sys.stderr)
        sys.exit(1)


def cmd_check_fern() -> None:
    if not shutil.which("fern"):
        print("fern CLI not found. Install: npm install -g fern-api@3.73.1", file=sys.stderr)
        sys.exit(1)


def cmd_set_ts_version(version: str) -> None:
    path = ROOT / "vendor/crystalith-sdks/typescript/package.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "get-backend":
        cmd_get_backend()
    elif cmd == "validate":
        cmd_validate(sys.argv[2] if len(sys.argv) > 2 else "")
    elif cmd == "check-all":
        cmd_check_all()
    elif cmd == "check-schema":
        cmd_check_schema(sys.argv[2])
    elif cmd == "check-fern":
        cmd_check_fern()
    elif cmd == "set-ts-version":
        cmd_set_ts_version(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
