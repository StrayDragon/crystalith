#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Range:
    category: str
    start: int


RANGES: list[Range] = [
    Range("refactor", 1000),
    Range("architecture", 2000),
    Range("ux", 3000),
    Range("feature", 4000),
]

CHANGE_ID_RE = re.compile(r"^(c\d+)-(.+)$")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def changes_dir(root: Path) -> Path:
    return root / "openspec" / "changes"


def load_priority_index(changes: Path) -> dict[str, object]:
    path = changes / "priority.json"
    if not path.exists():
        raise SystemExit(
            f"Missing {path}. Run: python scripts/openspec/rebuild_priority_index.py"
        )
    return json.loads(path.read_text(encoding="utf-8"))


def parse_change_id(change_name: str) -> int | None:
    m = re.match(r"^c(\d+)-", change_name)
    if not m:
        return None
    return int(m.group(1))


def build_rename_map(index: dict[str, object]) -> dict[str, str]:
    changes: dict[str, dict[str, object]] = index["changes"]  # type: ignore[assignment]

    by_category: dict[str, list[tuple[int, str, str]]] = {r.category: [] for r in RANGES}
    for name, meta in changes.items():
        m = CHANGE_ID_RE.match(name)
        if not m:
            continue
        old_id = parse_change_id(name)
        if old_id is None:
            continue
        old_code = m.group(1)
        slug = m.group(2)
        category = str(meta["category"])
        if category not in by_category:
            continue
        by_category[category].append((old_id, old_code, slug))

    mapping: dict[str, str] = {}
    for r in RANGES:
        items = sorted(by_category[r.category], key=lambda t: (t[0], t[1], t[2]))
        for offset, (old_id, old_code, slug) in enumerate(items):
            new_id = r.start + offset
            old_name = f"{old_code}-{slug}"
            new_name = f"c{new_id}-{slug}"
            mapping[old_name] = new_name

    # Collision check
    reverse: dict[str, list[str]] = {}
    for old, new in mapping.items():
        reverse.setdefault(new, []).append(old)
    collisions = {k: v for k, v in reverse.items() if len(v) > 1}
    if collisions:
        lines = ["Rename collisions detected:"]
        for new, olds in sorted(collisions.items()):
            lines.append(f"- {new}: {', '.join(sorted(olds))}")
        raise SystemExit("\n".join(lines))

    return mapping


def rename_directories(changes: Path, mapping: dict[str, str]) -> None:
    tmp_prefix = "_renumber_tmp__"
    tmp_paths: dict[str, Path] = {}

    # Phase 1: old -> tmp (avoid collisions)
    for old in sorted(mapping.keys()):
        src = changes / old
        if not src.exists():
            raise SystemExit(f"Not found: {src}")
        tmp = changes / f"{tmp_prefix}{old}"
        if tmp.exists():
            raise SystemExit(f"Temp path exists: {tmp}")
        src.rename(tmp)
        tmp_paths[old] = tmp

    # Phase 2: tmp -> new
    for old in sorted(mapping.keys()):
        tmp = tmp_paths[old]
        new = changes / mapping[old]
        if new.exists():
            raise SystemExit(f"Target path exists: {new}")
        tmp.rename(new)


def build_code_map(mapping: dict[str, str]) -> dict[str, str]:
    code_map: dict[str, str] = {}
    for old_name, new_name in mapping.items():
        m_old = re.match(r"^(c\d+)-", old_name)
        m_new = re.match(r"^(c\d+)-", new_name)
        if not m_old or not m_new:
            continue
        code_map[m_old.group(1)] = m_new.group(1)
    return code_map


def replace_in_text(text: str, name_map: dict[str, str], code_map: dict[str, str]) -> str:
    # 1) Replace full change folder names first (exact strings, longest-first).
    for old in sorted(name_map.keys(), key=len, reverse=True):
        text = text.replace(old, name_map[old])

    # 2) Replace bare codes like `c00`, `c2043` with boundary-safe regex in one pass.
    #    Do this after full-name replacement to avoid touching the new folder names.
    if not code_map:
        return text

    codes = sorted(code_map.keys(), key=len, reverse=True)
    # NOTE: Avoid rewriting `cXX-...` style folder names we do *not* own (e.g. notplan changes).
    pattern = re.compile(
        rf"(?<![A-Za-z0-9_])({'|'.join(map(re.escape, codes))})(?![A-Za-z0-9_-])"
    )

    def repl(m: re.Match[str]) -> str:
        return code_map[m.group(1)]

    return pattern.sub(repl, text)


def rewrite_references(root: Path, name_map: dict[str, str]) -> None:
    code_map = build_code_map(name_map)
    openspec = root / "openspec"
    paths = list(openspec.rglob("*.md")) + list(openspec.rglob("*.yaml")) + list(openspec.rglob("*.yml"))
    for path in paths:
        # Skip generated files by naming convention
        if ".gen." in path.name:
            continue
        original = path.read_text(encoding="utf-8", errors="replace")
        updated = replace_in_text(original, name_map, code_map)
        if updated != original:
            path.write_text(updated, encoding="utf-8")


def main() -> int:
    root = repo_root()
    changes = changes_dir(root)

    index = load_priority_index(changes)
    mapping = build_rename_map(index)

    # Backup reminder: the calling workflow can create a tarball backup if desired.
    rename_directories(changes, mapping)
    rewrite_references(root, mapping)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
