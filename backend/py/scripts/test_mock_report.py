from __future__ import annotations

import argparse
import ast
import io
import json
import re
import tokenize
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


def _dotted_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _dotted_name(node.value)
        if base is None:
            return None
        return f"{base}.{node.attr}"
    return None


def _eval_str_expr(node: ast.AST) -> str | None:
    """
    Best-effort evaluation for string literals in AST.

    Supports:
    - string constants
    - concatenation via `+` when both sides are string-literal-evaluable
    - f-strings with only literal parts (no formatted values)
    """
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value

    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = _eval_str_expr(node.left)
        right = _eval_str_expr(node.right)
        if left is None or right is None:
            return None
        return f"{left}{right}"

    if isinstance(node, ast.JoinedStr):
        parts: list[str] = []
        for item in node.values:
            if isinstance(item, ast.Constant) and isinstance(item.value, str):
                parts.append(item.value)
            else:
                return None
        return "".join(parts)

    return None


def _iter_call_keyword(call: ast.Call, name: str) -> ast.AST | None:
    for kw in call.keywords:
        if kw.arg == name:
            return kw.value
    return None


def _collect_monkeypatch_names(tree: ast.AST) -> set[str]:
    names: set[str] = set()

    def _is_monkeypatch_annotation(node: ast.AST | None) -> bool:
        if node is None:
            return False
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
            return _is_monkeypatch_annotation(node.left) or _is_monkeypatch_annotation(node.right)
        dotted = _dotted_name(node)
        return dotted in {"pytest.MonkeyPatch", "MonkeyPatch"}

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = [
                *node.args.posonlyargs,
                *node.args.args,
                *node.args.kwonlyargs,
            ]
            for arg in args:
                if arg.arg == "monkeypatch" or _is_monkeypatch_annotation(arg.annotation):
                    names.add(arg.arg)
    return names


def _collect_unittest_patch_names(tree: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "unittest.mock":
            for alias in node.names:
                if alias.name == "patch":
                    names.add(alias.asname or alias.name)
    return names


def _collect_unittest_module_names(tree: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "unittest":
                    names.add(alias.asname or alias.name)
    return names


def _collect_unittest_mock_module_names(tree: ast.AST) -> set[str]:
    """
    Collect local binding names that refer to `unittest.mock` (or `unittest`'s `mock` module).

    Supported patterns:
    - `from unittest import mock` (or `as <alias>`)
    - `import unittest.mock as <alias>`
    """
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "unittest":
            for alias in node.names:
                if alias.name == "mock":
                    names.add(alias.asname or alias.name)
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "unittest.mock" and alias.asname:
                    names.add(alias.asname)
    return names


def _private_patch_targets_ast(tree: ast.AST) -> list[str]:
    monkeypatch_names = _collect_monkeypatch_names(tree)
    unittest_patch_names = _collect_unittest_patch_names(tree)
    unittest_module_names = _collect_unittest_module_names(tree)
    unittest_mock_module_names = _collect_unittest_mock_module_names(tree)

    targets: set[str] = set()

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        func = node.func

        # monkeypatch.setattr(...)
        if (
            isinstance(func, ast.Attribute)
            and func.attr == "setattr"
            and isinstance(func.value, ast.Name)
            and func.value.id in monkeypatch_names
        ):
            target_expr: ast.AST | None = node.args[0] if node.args else _iter_call_keyword(node, "target")
            target_str = _eval_str_expr(target_expr) if target_expr is not None else None
            if target_str:
                attr = target_str.split(".")[-1]
                if attr.startswith("_"):
                    targets.add(target_str)

            name_expr: ast.AST | None = None
            if len(node.args) >= 2:
                name_expr = node.args[1]
            else:
                name_expr = _iter_call_keyword(node, "name")
            name_str = _eval_str_expr(name_expr) if name_expr is not None else None
            if name_str and name_str.startswith("_"):
                targets.add(name_str)
            continue

        dotted = _dotted_name(func)
        if not dotted:
            continue

        # patch("pkg.mod.attr") / mocker.patch("...") / unittest.mock.patch("...") variants
        is_patch = False
        if isinstance(func, ast.Name) and func.id in unittest_patch_names:
            is_patch = True
        elif dotted == "unittest.mock.patch":
            is_patch = True
        elif any(dotted == f"{name}.mock.patch" for name in unittest_module_names):
            is_patch = True
        elif any(dotted == f"{name}.patch" for name in unittest_mock_module_names):
            is_patch = True
        elif dotted == "mocker.patch":
            is_patch = True

        if is_patch:
            target_expr = node.args[0] if node.args else _iter_call_keyword(node, "target")
            target_str = _eval_str_expr(target_expr) if target_expr is not None else None
            if target_str:
                attr = target_str.split(".")[-1]
                if attr.startswith("_"):
                    targets.add(target_str)
            continue

        # patch.object(obj, "attr") / mocker.patch.object(...) / unittest.mock.patch.object(...) variants
        is_patch_object = False
        if (
            isinstance(func, ast.Attribute)
            and func.attr == "object"
            and isinstance(func.value, ast.Name)
            and func.value.id in unittest_patch_names
        ):
            is_patch_object = True
        elif dotted == "unittest.mock.patch.object":
            is_patch_object = True
        elif any(dotted == f"{name}.mock.patch.object" for name in unittest_module_names):
            is_patch_object = True
        elif any(dotted == f"{name}.patch.object" for name in unittest_mock_module_names):
            is_patch_object = True
        elif dotted == "mocker.patch.object":
            is_patch_object = True

        if is_patch_object:
            attr_expr: ast.AST | None = None
            if len(node.args) >= 2:
                attr_expr = node.args[1]
            else:
                attr_expr = _iter_call_keyword(node, "attribute")
            attr_str = _eval_str_expr(attr_expr) if attr_expr is not None else None
            if attr_str and attr_str.startswith("_"):
                targets.add(attr_str)

    return sorted(targets)


def _private_patch_targets_regex(content: str) -> list[str]:
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


_MONKEYPATCH_OP_NAMES = {
    "setattr",
    "setenv",
    "delenv",
    "setitem",
    "delitem",
    "chdir",
}


def _count_mock_reason_hits(content: str) -> int:
    try:
        tokens = tokenize.generate_tokens(io.StringIO(content).readline)
        return sum(
            1
            for token_type, token_string, _start, _end, _line in tokens
            if token_type == tokenize.COMMENT and "Mock reason:" in token_string
        )
    except tokenize.TokenError:
        # Fallback when content is not tokenizable (e.g., broken string literal).
        return len(_MOCK_REASON_RE.findall(content))


def _count_monkeypatch_ops(tree: ast.AST, *, monkeypatch_names: set[str]) -> int:
    if not monkeypatch_names:
        return 0

    ops = 0
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr not in _MONKEYPATCH_OP_NAMES:
            continue
        if isinstance(func.value, ast.Name) and func.value.id in monkeypatch_names:
            ops += 1
    return ops


class _DoubleClassCollector(ast.NodeVisitor):
    def __init__(self) -> None:
        self.names: list[str] = []

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        if any(keyword in node.name for keyword in _DOUBLE_CLASS_KEYWORDS):
            self.names.append(node.name)
        self.generic_visit(node)


def _double_classes_ast(tree: ast.AST) -> list[str]:
    collector = _DoubleClassCollector()
    collector.visit(tree)
    return collector.names


def _unittest_mock_hits(tree: ast.AST) -> int:
    """
    Count `unittest.mock` usage signals based on AST.

    This intentionally ignores string literals/comments to avoid false positives.
    """
    hits = 0
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module == "unittest.mock":
                hits += len(node.names)
                continue
            if node.module == "unittest" and any(alias.name == "mock" for alias in node.names):
                hits += sum(1 for alias in node.names if alias.name == "mock")
                continue
        if isinstance(node, ast.Import):
            hits += sum(1 for alias in node.names if alias.name == "unittest.mock")
    return hits


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
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return _private_patch_targets_regex(content)

    return _private_patch_targets_ast(tree)


def _analyze_file(path: Path, *, base: Path) -> FileStats:
    content = path.read_text(encoding="utf-8")
    mock_reason_hits = _count_mock_reason_hits(content)

    try:
        tree = ast.parse(content)
    except SyntaxError:
        tree = None

    if tree is None:
        monkeypatch_ops = len(_MONKEYPATCH_OP_RE.findall(content))
        unittest_mock_hits = len(_UNITTEST_MOCK_RE.findall(content))
        doubles = _double_classes(content)
        private_targets = _private_patch_targets_regex(content)
        uses_monkeypatch = bool(_MONKEYPATCH_WORD_RE.search(content))
        uses_unittest_mock = bool(_UNITTEST_MOCK_RE.search(content))
    else:
        monkeypatch_names = _collect_monkeypatch_names(tree)
        monkeypatch_ops = _count_monkeypatch_ops(tree, monkeypatch_names=monkeypatch_names)
        unittest_mock_hits = _unittest_mock_hits(tree)
        doubles = _double_classes_ast(tree)
        private_targets = _private_patch_targets_ast(tree)
        uses_monkeypatch = bool(monkeypatch_names)
        uses_unittest_mock = unittest_mock_hits > 0

    return FileStats(
        path=path.relative_to(base).as_posix(),
        group=_group_key(path, base=base),
        uses_monkeypatch=uses_monkeypatch,
        monkeypatch_ops=monkeypatch_ops,
        uses_unittest_mock=uses_unittest_mock,
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
