#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys

TYPE_CHECKING_RE = re.compile(r"^\s*if\s+(?:typing\.)?TYPE_CHECKING\s*:")
IMPORT_RE = re.compile(r"^\s*(from|import)\s+crystalith\.(web|features)(\b|\.)")
COMMENT_RE = re.compile(r"^\s*#")


def _read_file_list() -> list[Path]:
    if sys.stdin.isatty():
        return []
    entries = [line.strip() for line in sys.stdin.read().splitlines() if line.strip()]
    return [Path(entry) for entry in entries]


def _iter_py_files() -> list[Path]:
    root = Path(__file__).resolve().parents[1] / "src" / "crystalith"
    candidates = []
    for base in (root / "features", root / "shared"):
        if not base.exists():
            continue
        candidates.extend(base.rglob("*.py"))
    return candidates


def _is_type_checking_line(line: str) -> bool:
    return TYPE_CHECKING_RE.match(line) is not None


def _check_file(path: Path, violations: list[str]) -> None:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return

    type_stack: list[int] = []
    lines = text.splitlines()
    for line_no, line in enumerate(lines, start=1):
        if COMMENT_RE.match(line):
            continue

        indent = len(line) - len(line.lstrip(" "))
        while type_stack and indent <= type_stack[-1]:
            type_stack.pop()

        if _is_type_checking_line(line):
            type_stack.append(indent)
            continue

        if type_stack:
            continue

        if IMPORT_RE.match(line):
            violations.append(f"{path}:{line_no}: {line.strip()}")


def main() -> int:
    files = _read_file_list()
    if not files:
        files = _iter_py_files()

    violations: list[str] = []
    for path in files:
        if path.suffix != ".py":
            continue
        _check_file(path, violations)

    if violations:
        print("Invalid import direction detected:")
        for item in violations:
            print(item)
        return 1

    print("Import direction check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
