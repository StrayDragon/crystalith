#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path


CHANGE_TOKEN_RE = re.compile(r"(?<![A-Za-z0-9_])(c\d{4})-([a-z0-9][a-z0-9-]*)(?![A-Za-z0-9_])")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_code_reverse_map(root: Path) -> dict[str, str]:
    mapping_path = root / "openspec" / "changes" / "RENAMED_MAP.json"
    if not mapping_path.exists():
        raise SystemExit(f"Missing {mapping_path}.")
    data = json.loads(mapping_path.read_text(encoding="utf-8"))
    old_to_new: dict[str, str] = data["old_to_new"]

    reverse: dict[str, str] = {}
    for old_name, new_name in old_to_new.items():
        old_code = old_name.split("-", 1)[0]
        new_code = new_name.split("-", 1)[0]
        reverse[new_code] = old_code
    return reverse


def repair_text(
    text: str, *, changes_dir: Path, reverse_code_map: dict[str, str]
) -> tuple[str, int]:
    replacements = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal replacements
        new_code = m.group(1)
        slug = m.group(2)
        candidate = f"{new_code}-{slug}"
        if (changes_dir / candidate).exists():
            return candidate
        old_code = reverse_code_map.get(new_code)
        if not old_code:
            return candidate
        replacements += 1
        return f"{old_code}-{slug}"

    updated = CHANGE_TOKEN_RE.sub(repl, text)
    return updated, replacements


def main() -> int:
    root = repo_root()
    openspec = root / "openspec"
    changes_dir = openspec / "changes"
    reverse_code_map = load_code_reverse_map(root)

    paths = list(openspec.rglob("*.md")) + list(openspec.rglob("*.yaml")) + list(openspec.rglob("*.yml"))
    total = 0
    changed_files = 0
    for path in paths:
        if ".gen." in path.name:
            continue
        original = path.read_text(encoding="utf-8", errors="replace")
        updated, n = repair_text(original, changes_dir=changes_dir, reverse_code_map=reverse_code_map)
        if n:
            total += n
            changed_files += 1
            path.write_text(updated, encoding="utf-8")

    print(f"repaired {total} refs in {changed_files} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
