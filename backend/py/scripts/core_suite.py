from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def _repo_root() -> Path:
    # backend/py/scripts/core_suite.py -> backend/py/scripts -> backend/py -> backend -> repo root
    return Path(__file__).resolve().parents[3]


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _manifest_path() -> Path:
    return (
        _repo_root()
        / "openspec"
        / "specs"
        / "quality-and-regression"
        / "core_suite.json"
    )


def _unique_stable(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _load_manifest() -> dict:
    manifest_path = _manifest_path()
    if not manifest_path.exists():
        raise FileNotFoundError(f"Core suite manifest not found: {manifest_path}")

    text = manifest_path.read_text(encoding="utf-8")
    return json.loads(text)


def _as_list_of_str(value: object, *, context: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise TypeError(f"Invalid {context}: expected list[str]")
    return value


def _load_backend_pytest_paths() -> list[str]:
    manifest = _load_manifest()
    core_paths = manifest.get("corePaths")
    if not isinstance(core_paths, list):
        raise TypeError("Invalid manifest: corePaths must be a list")

    collected: list[str] = []
    for entry in core_paths:
        if not isinstance(entry, dict):
            raise TypeError("Invalid manifest: corePaths entries must be objects")
        backend = entry.get("backend")
        if backend is None:
            continue
        if not isinstance(backend, dict):
            raise TypeError("Invalid manifest: corePaths[].backend must be an object")
        pytest_paths = _as_list_of_str(
            backend.get("pytestPaths"),
            context=f"corePaths[].backend.pytestPaths ({entry.get('id')!r})",
        )
        collected.extend(pytest_paths)

    paths = _unique_stable(collected)

    backend_root = _backend_root()
    for rel_path in paths:
        abs_path = backend_root / rel_path
        if not abs_path.exists():
            raise FileNotFoundError(f"Core suite pytest path missing: {rel_path}")

    return paths


def _usage() -> None:
    print("Usage:", file=sys.stderr)
    print("  uv run python scripts/core_suite.py print", file=sys.stderr)
    print("  uv run python scripts/core_suite.py run [-- <pytest args>]", file=sys.stderr)


def main() -> int:
    argv = sys.argv[1:]
    subcommand = argv[0] if argv else "run"

    forwarded = argv[1:]
    if forwarded and forwarded[0] == "--":
        forwarded = forwarded[1:]

    try:
        paths = _load_backend_pytest_paths()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 2

    if subcommand == "print":
        print(" ".join(paths))
        return 0

    if subcommand == "run":
        cmd = [
            sys.executable,
            "-m",
            "pytest",
            "-v",
            "--no-cov",
            "-m",
            "core",
            *paths,
            *forwarded,
        ]
        result = subprocess.run(cmd, cwd=_backend_root())
        return result.returncode

    _usage()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
