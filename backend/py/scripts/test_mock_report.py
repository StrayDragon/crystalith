from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class FileStats:
    path: str
    group: str
    uses_monkeypatch: bool
    monkeypatch_ops: int
    uses_unittest_mock: bool
    unittest_mock_hits: int
    double_classes: list[str]
    mock_reason_hits: int
    private_patch_targets: list[str]

    @property
    def uses_any_test_double(self) -> bool:
        return self.uses_monkeypatch or self.uses_unittest_mock or bool(self.double_classes)


_CLASS_DEF_RE = re.compile(r"^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\b", re.MULTILINE)
_MOCK_REASON_RE = re.compile(r"Mock reason:")
_MONKEYPATCH_WORD_RE = re.compile(r"\bmonkeypatch\b")
_MONKEYPATCH_OP_RE = re.compile(
    r"\bmonkeypatch\.(setattr|setenv|delenv|setitem|delitem|chdir)\b"
)
_UNITTEST_MOCK_RE = re.compile(r"\bfrom\s+unittest\.mock\s+import\b|\bunittest\.mock\b")

# monkeypatch.setattr("pkg.mod.attr", value, raising=True)
_SETATTR_STRING_TARGET_RE = re.compile(
    r"monkeypatch\.setattr\(\s*(['\"])(?P<target>[^'\"]+)\1\s*,",
    re.DOTALL,
)
# monkeypatch.setattr(obj, "attr", value, raising=True)
_SETATTR_OBJ_NAME_RE = re.compile(
    r"monkeypatch\.setattr\(\s*(?!['\"]).+?\s*,\s*(['\"])(?P<name>[^'\"]+)\1",
    re.DOTALL,
)

_UNITTEST_PATCH_STRING_TARGET_RE = re.compile(
    r"(?<!\.)\bpatch\(\s*(['\"])(?P<target>[^'\"]+)\1",
    re.DOTALL,
)
_UNITTEST_PATCH_ATTR_TARGET_RE = re.compile(
    r"(?<!\.)\bpatch\.object\(\s*[^,]+,\s*(['\"])(?P<attr>[^'\"]+)\1",
    re.DOTALL,
)
_UNITTEST_MOCK_DOTTED_PATCH_RE = re.compile(
    r"\b(unittest\.mock|mock)\.patch\(\s*(['\"])(?P<target>[^'\"]+)\2",
    re.DOTALL,
)
_UNITTEST_MOCK_DOTTED_PATCH_OBJECT_RE = re.compile(
    r"\b(unittest\.mock|mock)\.patch\.object\(\s*[^,]+,\s*(['\"])(?P<attr>[^'\"]+)\2",
    re.DOTALL,
)
_PYTEST_MOCK_PATCH_RE = re.compile(
    r"\bmocker\.patch\(\s*(['\"])(?P<target>[^'\"]+)\1",
    re.DOTALL,
)
_PYTEST_MOCK_PATCH_OBJECT_RE = re.compile(
    r"\bmocker\.patch\.object\(\s*[^,]+,\s*(['\"])(?P<attr>[^'\"]+)\1",
    re.DOTALL,
)

_DOUBLE_CLASS_KEYWORDS = (
    "Mock",
    "Stub",
    "Fake",
    "Dummy",
)


def _iter_test_files(base: Path) -> list[Path]:
    service = sorted(base.glob("tests/**/test_*.py"))
    packages = sorted(base.glob("packages/*/tests/**/test_*.py"))
    return [p for p in (service + packages) if p.is_file()]


def _group_key(path: Path, *, base: Path) -> str:
    rel = path.relative_to(base)
    parts = rel.parts
    if not parts:
        return "."
    if parts[0] == "tests":
        if len(parts) >= 2 and parts[1] == "features" and len(parts) >= 3:
            if parts[2].endswith(".py"):
                return "tests/features"
            return f"tests/features/{parts[2]}"
        if len(parts) >= 2:
            return f"tests/{parts[1]}"
        return "tests"
    if parts[0] == "packages" and len(parts) >= 2:
        return f"packages/{parts[1]}"
    return parts[0]


def _double_classes(content: str) -> list[str]:
    names = [m.group(1) for m in _CLASS_DEF_RE.finditer(content)]
    return [name for name in names if any(keyword in name for keyword in _DOUBLE_CLASS_KEYWORDS)]


def _private_patch_targets(content: str) -> list[str]:
    targets: list[str] = []

    uses_unittest_mock = bool(_UNITTEST_MOCK_RE.search(content))
    uses_pytest_mock = bool(re.search(r"\bmocker\b", content))

    for m in _SETATTR_STRING_TARGET_RE.finditer(content):
        target = m.group("target")
        attr = target.split(".")[-1]
        if attr.startswith("_"):
            targets.append(target)

    for m in _SETATTR_OBJ_NAME_RE.finditer(content):
        name = m.group("name")
        if name.startswith("_"):
            targets.append(name)

    if uses_unittest_mock:
        for m in _UNITTEST_PATCH_STRING_TARGET_RE.finditer(content):
            target = m.group("target")
            attr = target.split(".")[-1]
            if attr.startswith("_"):
                targets.append(target)

        for m in _UNITTEST_MOCK_DOTTED_PATCH_RE.finditer(content):
            target = m.group("target")
            attr = target.split(".")[-1]
            if attr.startswith("_"):
                targets.append(target)

        for m in _UNITTEST_PATCH_ATTR_TARGET_RE.finditer(content):
            attr = m.group("attr")
            if attr.startswith("_"):
                targets.append(attr)

        for m in _UNITTEST_MOCK_DOTTED_PATCH_OBJECT_RE.finditer(content):
            attr = m.group("attr")
            if attr.startswith("_"):
                targets.append(attr)

    if uses_pytest_mock:
        for m in _PYTEST_MOCK_PATCH_RE.finditer(content):
            target = m.group("target")
            attr = target.split(".")[-1]
            if attr.startswith("_"):
                targets.append(target)

        for m in _PYTEST_MOCK_PATCH_OBJECT_RE.finditer(content):
            attr = m.group("attr")
            if attr.startswith("_"):
                targets.append(attr)

    # Return stable order for deterministic output.
    return sorted(set(targets))


def _analyze_file(path: Path, *, base: Path) -> FileStats:
    content = path.read_text(encoding="utf-8")
    monkeypatch_ops = len(_MONKEYPATCH_OP_RE.findall(content))
    unittest_mock_hits = len(_UNITTEST_MOCK_RE.findall(content))
    mock_reason_hits = len(_MOCK_REASON_RE.findall(content))
    doubles = _double_classes(content)
    private_targets = _private_patch_targets(content)
    return FileStats(
        path=path.relative_to(base).as_posix(),
        group=_group_key(path, base=base),
        uses_monkeypatch=bool(_MONKEYPATCH_WORD_RE.search(content)),
        monkeypatch_ops=monkeypatch_ops,
        uses_unittest_mock=bool(_UNITTEST_MOCK_RE.search(content)),
        unittest_mock_hits=unittest_mock_hits,
        double_classes=doubles,
        mock_reason_hits=mock_reason_hits,
        private_patch_targets=private_targets,
    )


def _pct(part: int, total: int) -> float:
    return round((part / total * 100.0) if total else 0.0, 2)


def _print_report(
    *,
    file_stats: list[FileStats],
    top: int,
) -> None:
    total_files = len(file_stats)
    any_doubles = [fs for fs in file_stats if fs.uses_any_test_double]
    with_monkeypatch = [fs for fs in file_stats if fs.uses_monkeypatch]
    with_unittest_mock = [fs for fs in file_stats if fs.uses_unittest_mock]
    with_double_classes = [fs for fs in file_stats if fs.double_classes]

    total_monkeypatch_ops = sum(fs.monkeypatch_ops for fs in file_stats)
    total_mock_reason_hits = sum(fs.mock_reason_hits for fs in file_stats)
    monkeypatch_reason_rate = (
        round(total_mock_reason_hits / total_monkeypatch_ops, 2) if total_monkeypatch_ops else 0.0
    )

    print("== Test Doubles / Mock Usage Report ==")
    print(f"Test files: {total_files}")
    print(
        "Any test double technique: "
        f"{len(any_doubles)} ({_pct(len(any_doubles), total_files)}%)"
    )
    print(
        f"monkeypatch: {len(with_monkeypatch)} ({_pct(len(with_monkeypatch), total_files)}%)"
    )
    print(
        "unittest.mock: "
        f"{len(with_unittest_mock)} ({_pct(len(with_unittest_mock), total_files)}%)"
    )
    print(
        "class-based doubles (Mock/Stub/Fake/Dummy): "
        f"{len(with_double_classes)} ({_pct(len(with_double_classes), total_files)}%)"
    )
    if with_double_classes:
        keyword_counts: Counter[str] = Counter()
        for fs in with_double_classes:
            for cls in fs.double_classes:
                for keyword in _DOUBLE_CLASS_KEYWORDS:
                    if keyword in cls:
                        keyword_counts[keyword] += 1
                        break
        if keyword_counts:
            pretty = ", ".join(
                f"{keyword}={count}" for keyword, count in keyword_counts.most_common()
            )
            print(f"class keyword distribution: {pretty}")
    print()
    print("== Mock Reason Coverage ==")
    print(f'"Mock reason:" hits: {total_mock_reason_hits}')
    print(f"monkeypatch ops: {total_monkeypatch_ops}")
    print(f"reasons per monkeypatch op: {monkeypatch_reason_rate}")

    no_reason_but_patch = [
        fs for fs in file_stats if fs.monkeypatch_ops and fs.mock_reason_hits == 0
    ]
    if no_reason_but_patch:
        print()
        print("Files with monkeypatch ops but no \"Mock reason:\" comment (top):")
        for fs in sorted(no_reason_but_patch, key=lambda x: (-x.monkeypatch_ops, x.path))[:top]:
            print(f"- {fs.path} ({fs.monkeypatch_ops} ops)")

    print()
    print("== Group Distribution ==")
    group_total: Counter[str] = Counter(fs.group for fs in file_stats)
    group_any: Counter[str] = Counter(fs.group for fs in any_doubles)
    group_monkeypatch: Counter[str] = Counter(fs.group for fs in with_monkeypatch)
    group_unittest_mock: Counter[str] = Counter(fs.group for fs in with_unittest_mock)
    group_double_classes: Counter[str] = Counter(fs.group for fs in with_double_classes)
    for group in sorted(group_total.keys()):
        total = group_total[group]
        any_cnt = group_any.get(group, 0)
        mp_cnt = group_monkeypatch.get(group, 0)
        um_cnt = group_unittest_mock.get(group, 0)
        dc_cnt = group_double_classes.get(group, 0)
        print(
            f"- {group}: any={any_cnt}/{total} ({_pct(any_cnt, total)}%); "
            f"monkeypatch={mp_cnt}; unittest.mock={um_cnt}; class_doubles={dc_cnt}"
        )

    print()
    print("== Hotspots (by test-double score) ==")
    scored = []
    for fs in file_stats:
        score = fs.monkeypatch_ops + fs.unittest_mock_hits + len(fs.double_classes)
        scored.append((score, fs))
    for score, fs in sorted(scored, key=lambda it: (-it[0], it[1].path))[:top]:
        if score == 0:
            break
        parts = []
        if fs.monkeypatch_ops:
            parts.append(f"monkeypatch_ops={fs.monkeypatch_ops}")
        if fs.uses_unittest_mock:
            parts.append(f"unittest_mock_hits={fs.unittest_mock_hits}")
        if fs.double_classes:
            parts.append(f"double_classes={len(fs.double_classes)}")
        print(f"- {fs.path} (score={score}; {', '.join(parts)})")

    print()
    print("== Private Patch Targets ==")
    private_hits: Counter[str] = Counter()
    private_files: dict[str, set[str]] = {}
    for fs in file_stats:
        for target in fs.private_patch_targets:
            private_hits[target] += 1
            private_files.setdefault(target, set()).add(fs.path)
    if not private_hits:
        print("(none)")
        return
    for target, _cnt in private_hits.most_common(top):
        files = sorted(private_files.get(target, set()))
        print(f"- {target} ({len(files)} file(s))")
        for file in files:
            print(f"  - {file}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Report mock/test-double usage across backend Python tests.",
    )
    parser.add_argument(
        "--base",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Base directory (defaults to backend/py).",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=15,
        help="How many hotspot rows to print.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print a JSON payload instead of a human report.",
    )
    parser.add_argument(
        "--check-private-patches",
        action="store_true",
        help="Exit non-zero if any private patch target is detected.",
    )
    args = parser.parse_args(argv)

    base: Path = args.base.resolve()
    test_files = _iter_test_files(base)
    stats = [_analyze_file(p, base=base) for p in test_files]

    if args.json:
        payload: dict[str, Any] = {
            "base": base.as_posix(),
            "test_files": len(stats),
            "files": [asdict(fs) for fs in stats],
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 1 if (args.check_private_patches and any(fs.private_patch_targets for fs in stats)) else 0

    _print_report(file_stats=stats, top=args.top)
    return 1 if (args.check_private_patches and any(fs.private_patch_targets for fs in stats)) else 0


if __name__ == "__main__":
    raise SystemExit(main())
