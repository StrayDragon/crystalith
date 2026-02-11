#!/usr/bin/env python3
from __future__ import annotations

import argparse
import difflib
from pathlib import Path


def _repo_root() -> Path:
    # scripts/deploy/sync_prod_compose.py -> scripts -> <repo root>
    return Path(__file__).resolve().parents[2]


def _render_root_compose(source: str) -> str:
    lines: list[str] = []
    for line in source.splitlines(keepends=True):
        stripped = line.strip()

        if stripped == "context: ../..":
            prefix = line[: line.index("c")]
            lines.append(f"{prefix}context: .\n")
            continue

        if stripped == "- ../../config:/app/config:ro":
            prefix = line[: line.index("-")]
            lines.append(f"{prefix}- ./config:/app/config:ro\n")
            continue

        lines.append(line)

    header = (
        "# NOTE: This file is generated from deployments/prod/docker-compose.yml.\n"
        "# Run: python scripts/deploy/sync_prod_compose.py\n"
    )
    return header + "".join(lines)


def _diff(a: str, b: str, *, a_name: str, b_name: str) -> str:
    return "".join(
        difflib.unified_diff(
            a.splitlines(keepends=True),
            b.splitlines(keepends=True),
            fromfile=a_name,
            tofile=b_name,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync root docker-compose.prod.yml from deployments/prod.")
    parser.add_argument("--check", action="store_true", help="Fail if root file is out of date.")
    args = parser.parse_args()

    root = _repo_root()
    source_path = root / "deployments/prod/docker-compose.yml"
    dest_path = root / "docker-compose.prod.yml"

    source = source_path.read_text(encoding="utf-8")
    rendered = _render_root_compose(source)

    if args.check:
        if not dest_path.exists():
            print(f"Missing {dest_path}. Run sync to generate it.")
            return 1
        existing = dest_path.read_text(encoding="utf-8")
        if existing == rendered:
            return 0
        print(_diff(existing, rendered, a_name=str(dest_path), b_name="(generated)"))
        return 1

    dest_path.write_text(rendered, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

