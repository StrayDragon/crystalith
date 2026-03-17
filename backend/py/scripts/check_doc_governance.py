#!/usr/bin/env python3
"""Repo-level doc governance checks (fast fail, no generation)."""

from __future__ import annotations

import os
import sys
import tomllib
from pathlib import Path

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


def _load_docs_project_config(*, repo_root: Path) -> tuple[Path, dict[str, object]] | None:
    config_path = repo_root / "docs/zensical.toml"
    if not config_path.is_file():
        _fail("Missing docs/zensical.toml.")
        return None

    payload = tomllib.loads(config_path.read_text(encoding="utf-8"))
    project = payload.get("project")
    if not isinstance(project, dict):
        _fail("docs/zensical.toml missing required [project] table.")
        return None

    return config_path, project


def _docs_root(*, repo_root: Path) -> Path | None:
    loaded = _load_docs_project_config(repo_root=repo_root)
    if loaded is None:
        return None
    config_path, project = loaded

    docs_dir = project.get("docs_dir")
    if not isinstance(docs_dir, str) or not docs_dir.strip():
        _fail("docs/zensical.toml missing required project.docs_dir.")
        return None
    if docs_dir != "doc":
        _fail(f'docs/zensical.toml project.docs_dir MUST be "doc" (got: {docs_dir!r}).')
        return None

    site_dir = project.get("site_dir")
    if not isinstance(site_dir, str) or not site_dir.strip():
        _fail("docs/zensical.toml missing required project.site_dir.")
        return None
    if site_dir != "site":
        _fail(f'docs/zensical.toml project.site_dir MUST be "site" (got: {site_dir!r}).')
        return None

    docs_base = config_path.parent.resolve()
    docs_root = (docs_base / Path(docs_dir)).resolve()
    if not docs_root.is_relative_to(docs_base):
        _fail(f"docs/zensical.toml project.docs_dir must resolve under {docs_base} (got: {docs_root}).")
        return None
    if not docs_root.is_dir():
        _fail(f"docs/zensical.toml project.docs_dir does not exist: {docs_root}.")
        return None

    expected = (repo_root / "docs/doc").resolve()
    if docs_root != expected:
        _fail(f"docs root MUST be {expected} (got: {docs_root}).")
        return None

    return docs_root


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
        for item in value.values():
            found |= _collect_nav_paths(item)
        return found
    return found


def _check_docs_nav(*, repo_root: Path) -> bool:
    loaded = _load_docs_project_config(repo_root=repo_root)
    if loaded is None:
        return False
    _, project = loaded
    nav = project.get("nav")
    nav_paths = _collect_nav_paths(nav)

    ok = True
    for rel in REQUIRED_REFERENCE_PAGES:
        if rel not in nav_paths:
            _fail(f"docs/zensical.toml nav MUST include: {rel}")
            ok = False
    return ok


def _check_reference_headers(*, docs_root: Path) -> bool:
    ok = True
    for rel in REQUIRED_REFERENCE_PAGES:
        path = docs_root / rel
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
    docs_root = _docs_root(repo_root=repo_root)
    if docs_root is None:
        ok = False
    else:
        ok = _check_docs_nav(repo_root=repo_root) and ok
        ok = _check_reference_headers(docs_root=docs_root) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
