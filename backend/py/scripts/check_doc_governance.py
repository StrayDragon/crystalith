#!/usr/bin/env python3
"""Repo-level doc governance checks (fast fail, no generation)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import yaml


REQUIRED_REFERENCE_PAGES = [
    "reference/config-schema.gen.md",
    "reference/env-vars.gen.md",
    "reference/plugins.gen.md",
]


def _repo_root() -> Path:
    start = Path(__file__).resolve()
    for parent in (start, *start.parents):
        if (parent / "justfile").is_file() and (parent / "openspec").is_dir():
            return parent
    raise FileNotFoundError("Could not locate repo root (missing justfile/openspec markers).")


def _fail(message: str) -> None:
    print(f"[doc-governance-check] {message}", file=sys.stderr)


def _check_claude_symlink(repo_root: Path) -> bool:
    claude_path = repo_root / "CLAUDE.md"
    agents_path = repo_root / "AGENTS.md"
    if not claude_path.exists():
        _fail("Missing CLAUDE.md at repo root.")
        return False
    if not agents_path.is_file():
        _fail("Missing AGENTS.md at repo root.")
        return False
    if not claude_path.is_symlink():
        _fail("CLAUDE.md MUST be a symlink to AGENTS.md.")
        return False
    try:
        target = (repo_root / os.readlink(claude_path)).resolve()
    except OSError as exc:
        _fail(f"Failed to read CLAUDE.md symlink: {exc}")
        return False
    if target != agents_path.resolve():
        _fail(f"CLAUDE.md symlink target must be AGENTS.md (got: {target}).")
        return False
    return True


def _collect_nav_paths(value: object) -> set[str]:
    found: set[str] = set()
    if isinstance(value, str):
        if value.endswith(".md"):
            found.add(value)
        return found
    if isinstance(value, list):
        for item in value:
            found |= _collect_nav_paths(item)
        return found
    if isinstance(value, dict):
        for _, item in value.items():
            found |= _collect_nav_paths(item)
        return found
    return found


def _check_mkdocs_nav(repo_root: Path) -> bool:
    mkdocs_path = repo_root / "mkdocs.yml"
    if not mkdocs_path.is_file():
        _fail("Missing mkdocs.yml at repo root.")
        return False
    payload = yaml.safe_load(mkdocs_path.read_text(encoding="utf-8")) or {}
    nav = payload.get("nav")
    nav_paths = _collect_nav_paths(nav)

    ok = True
    for rel in REQUIRED_REFERENCE_PAGES:
        if rel not in nav_paths:
            _fail(f"mkdocs.yml nav MUST include: {rel}")
            ok = False
    return ok


def _check_reference_headers(repo_root: Path) -> bool:
    docs_dir = repo_root / "docs/content"
    ok = True
    for rel in REQUIRED_REFERENCE_PAGES:
        path = docs_dir / rel
        if not path.is_file():
            _fail(f"Missing generated reference page: {path}")
            ok = False
            continue
        head = "\n".join(path.read_text(encoding="utf-8").splitlines()[:20])
        if "AUTO-GENERATED" not in head or "just gen-docs" not in head:
            _fail(f"Generated reference page missing required header hint: {path}")
            ok = False
    return ok


def main() -> int:
    repo_root = _repo_root()
    ok = True
    ok = _check_claude_symlink(repo_root) and ok
    ok = _check_mkdocs_nav(repo_root) and ok
    ok = _check_reference_headers(repo_root) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
